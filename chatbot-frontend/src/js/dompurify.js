

const loadExternalScript = (src, integrity, crossOrigin, referrerPolicy, onLoadCallback) => {
    const script = document.createElement('script');
    script.src = src;
    if (integrity) script.integrity = integrity;
    if (crossOrigin) script.crossOrigin = crossOrigin;
    if (referrerPolicy) script.referrerPolicy = referrerPolicy;

    script.onload = onLoadCallback;
    script.onerror = () => console.error(`Failed to load script: ${src}`);

    document.head.appendChild(script);
};

const loadDomPurify = () => {
    loadExternalScript(
        'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.2.3/purify.min.js',
        'sha512-Ll+TuDvrWDNNRnFFIM8dOiw7Go7dsHyxRp4RutiIFW/wm3DgDmCnRZow6AqbXnCbpWu93yM1O34q+4ggzGeXVA==',
        'anonymous',
        'no-referrer'
    );
};

export { loadDomPurify };