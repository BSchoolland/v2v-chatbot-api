// Regression guard for CVE-2025-11849 (GHSA-rmjr-87wv-gf87).
// A .docx can reference an image by *external* link (r:link -> TargetMode="External")
// instead of embedding it. mammoth < 1.11.0 resolved that link straight to a local
// filesystem path, read the file, and base64'd it into the output — so an uploaded
// document could exfiltrate any file the server process can read.

const fs = require('fs');
const os = require('os');
const path = require('path');
// jszip ships as a dependency of mammoth.
const JSZip = require('jszip');
const mammoth = require('mammoth');
const TextExtractor = require('../../backend/api/files/textExtractor');

const CANARY = 'EVERGREEN_CANARY_SHOULD_NOT_BE_READABLE';

function buildDocxLinkingTo(targetPath) {
    const zip = new JSZip();

    zip.file('[Content_Types].xml',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
        '</Types>');

    zip.folder('_rels').file('.rels',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
        '</Relationships>');

    // The attack: an image relationship pointing at an absolute path outside the archive.
    zip.folder('word').folder('_rels').file('document.xml.rels',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rIdExternal" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"' +
        ' Target="' + targetPath + '" TargetMode="External"/>' +
        '</Relationships>');

    zip.folder('word').file('document.xml',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"' +
        ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"' +
        ' xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"' +
        ' xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"' +
        ' xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
        '<w:body><w:p><w:r><w:t>ordinary document text</w:t></w:r></w:p>' +
        '<w:p><w:r><w:drawing><wp:inline><wp:docPr id="1" name="pic" descr="alt"/>' +
        '<a:graphic><a:graphicData><pic:pic><pic:blipFill><a:blip r:link="rIdExternal"/></pic:blipFill>' +
        '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>' +
        '</w:body></w:document>');

    return zip.generateAsync({ type: 'nodebuffer' });
}

function decodeAnyDataUris(html) {
    const matches = html.match(/base64,([A-Za-z0-9+/=]+)/g) || [];
    return matches.map(m => Buffer.from(m.slice('base64,'.length), 'base64').toString('utf8')).join('\n');
}

describe('docx upload cannot read files outside the archive', () => {
    let tmpDir;
    let secretPath;
    let docxPath;

    beforeAll(async () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docx-ext-'));
        secretPath = path.join(tmpDir, 'secret.txt');
        fs.writeFileSync(secretPath, CANARY);

        docxPath = path.join(tmpDir, 'external-image.docx');
        fs.writeFileSync(docxPath, await buildDocxLinkingTo(secretPath));
    });

    afterAll(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    test('TextExtractor returns the document text without the linked file contents', async () => {
        const text = await TextExtractor.extractFromFile(
            docxPath,
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        );

        expect(text).toContain('ordinary document text');
        expect(text).not.toContain(CANARY);
    });

    // Guards the extractor against being switched to the HTML pipeline, which is
    // where the vulnerable image path lives.
    test('mammoth does not embed the linked file when converting to HTML', async () => {
        const result = await mammoth.convertToHtml({ path: docxPath });

        expect(result.value).not.toContain(CANARY);
        expect(decodeAnyDataUris(result.value)).not.toContain(CANARY);
    });
});
