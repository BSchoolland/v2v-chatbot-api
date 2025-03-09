const { scraperManager } = require('./scraperManager.js');
const os = require('os');

function getCPUUsage() {
    const cpus = os.cpus();
    return cpus.reduce((acc, cpu) => {
        const total = Object.values(cpu.times).reduce((a, b) => a + b);
        const idle = cpu.times.idle;
        return acc + ((total - idle) / total);
    }, 0) / cpus.length * 100;
}

function formatMemoryUsage(memory) {
    return {
        heapUsed: `${(memory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(memory.heapTotal / 1024 / 1024).toFixed(2)} MB`,
        external: `${(memory.external / 1024 / 1024).toFixed(2)} MB`,
        rss: `${(memory.rss / 1024 / 1024).toFixed(2)} MB`,
        // Add detailed V8 memory info if available
        v8Memory: process.memoryUsage.detailed ? formatV8Memory(process.memoryUsage.detailed()) : null
    };
}

function formatV8Memory(detailed) {
    if (!detailed) return null;
    return {
        code: `${(detailed.code / 1024 / 1024).toFixed(2)} MB`,
        stack: `${(detailed.stack / 1024 / 1024).toFixed(2)} MB`,
        heap: `${(detailed.heap / 1024 / 1024).toFixed(2)} MB`,
        external: `${(detailed.external / 1024 / 1024).toFixed(2)} MB`,
        arrayBuffers: `${(detailed.arrayBuffers / 1024 / 1024).toFixed(2)} MB`
    };
}

// Track memory over time
const memoryTimeline = [];
function trackMemory(label) {
    const memory = process.memoryUsage();
    memoryTimeline.push({
        timestamp: Date.now(),
        label,
        memory: formatMemoryUsage(memory)
    });
}

async function runJob(scraper, url, id, depth, maxPages) {
    console.log(`\nStarting job ${id}: ${url} (depth: ${depth}, maxPages: ${maxPages})`);
    trackMemory(`Before Job ${id}`);
    const startMemory = process.memoryUsage();
    console.log('Memory at start:', formatMemoryUsage(startMemory));

    const {job} = await scraper.addJob(url, `test-${id}`, depth, maxPages);
    
    // Monitor until complete
    while (!job.isJobComplete()) {
        const currentMemory = process.memoryUsage();
        console.log(`\nJob ${id} memory:`, formatMemoryUsage(currentMemory));
        console.log('Difference from start:', {
            heapUsed: `${((currentMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024).toFixed(2)} MB`,
            rss: `${((currentMemory.rss - startMemory.rss) / 1024 / 1024).toFixed(2)} MB`
        });
        console.log('Job status:', {
            processing: job.processingUrls.size,
            queueLength: job.queue.length,
            completed: job.completedPages.length,
            done: job.done
        });
        trackMemory(`During Job ${id}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const endMemory = process.memoryUsage();
    console.log(`\nJob ${id} completed. Final memory:`, formatMemoryUsage(endMemory));
    trackMemory(`After Job ${id}`);
    return endMemory;
}

async function runMemoryTest() {
    console.log('Starting memory leak test...');
    trackMemory('Initial State');
    await scraperManager.init();

    const initialMemory = process.memoryUsage();
    console.log('\nInitial memory state:', formatMemoryUsage(initialMemory));

    // Run 5 jobs in sequence with different configurations
    const jobs = [
        { url: 'https://example.com', depth: 1, pages: 5 },
        { url: 'https://httpbin.org', depth: 2, pages: 10 },
        { url: 'https://httpstat.us', depth: 1, pages: 5 },
        { url: 'https://example.com', depth: 2, pages: 10 },
        { url: 'https://httpbin.org', depth: 1, pages: 5 }
    ];

    const memorySnapshots = [];
    
    for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        
        // Force GC before each job
        if (global.gc) {
            global.gc();
            trackMemory(`After GC before Job ${i + 1}`);
        }
        
        const jobMemory = await runJob(scraper, job.url, i + 1, job.depth, job.pages);
        memorySnapshots.push(jobMemory);
        
        // Cleanup after each job
        await scraper.cleanup();
        trackMemory(`After Cleanup Job ${i + 1}`);
        
        // Force GC after cleanup
        if (global.gc) {
            global.gc();
            trackMemory(`After GC after Job ${i + 1}`);
        }
        
        // Wait a bit between jobs
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Final cleanup
    await scraper.cleanup();
    trackMemory('After Final Cleanup');
    if (global.gc) {
        global.gc();
        trackMemory('After Final GC');
    }

    // Final measurements
    const finalMemory = process.memoryUsage();
    
    // Analysis
    console.log('\n=== Memory Leak Analysis ===');
    console.log('Initial memory:', formatMemoryUsage(initialMemory));
    console.log('Final memory:', formatMemoryUsage(finalMemory));
    
    console.log('\nMemory Timeline:');
    memoryTimeline.forEach(entry => {
        console.log(`\n${entry.label} (${new Date(entry.timestamp).toISOString()}):`);
        console.log(entry.memory);
    });

    console.log('\nMemory differences after each job (compared to initial):');
    memorySnapshots.forEach((snapshot, i) => {
        console.log(`Job ${i + 1}:`, {
            heapUsed: `${((snapshot.heapUsed - initialMemory.heapUsed) / 1024 / 1024).toFixed(2)} MB`,
            rss: `${((snapshot.rss - initialMemory.rss) / 1024 / 1024).toFixed(2)} MB`
        });
    });
    
    console.log('\nFinal difference:', {
        heapUsed: `${((finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024).toFixed(2)} MB`,
        rss: `${((finalMemory.rss - initialMemory.rss) / 1024 / 1024).toFixed(2)} MB`
    });

    // Check for potential memory leaks
    const heapGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
    const rssGrowth = finalMemory.rss - initialMemory.rss;
    
    console.log('\nMemory Leak Assessment:');
    if (heapGrowth > 5 * 1024 * 1024) { // More than 5MB growth
        console.log('WARNING: Possible memory leak detected in heap usage');
        console.log('Largest memory spikes:');
        const spikes = memoryTimeline
            .map((entry, i) => {
                if (i === 0) return null;
                const prev = memoryTimeline[i - 1];
                const heapGrowth = parseInt(entry.memory.heapUsed) - parseInt(prev.memory.heapUsed);
                return { label: entry.label, growth: heapGrowth, timestamp: entry.timestamp };
            })
            .filter(spike => spike !== null)
            .sort((a, b) => b.growth - a.growth)
            .slice(0, 5);
        spikes.forEach(spike => {
            console.log(`${spike.label}: ${(spike.growth / 1024 / 1024).toFixed(2)} MB growth`);
        });
    } else if (heapGrowth < 0) {
        console.log('GOOD: Final heap usage is less than initial (memory was properly released)');
    } else {
        console.log('OK: Heap usage growth is within acceptable range');
    }
    
    if (rssGrowth > 10 * 1024 * 1024) { // More than 10MB growth
        console.log('WARNING: Possible memory leak detected in RSS');
    } else {
        console.log('OK: RSS growth is within acceptable range');
    }
}

runMemoryTest().catch(console.error); 