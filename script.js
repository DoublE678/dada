let cpuData = [];

fetch('tpu_cpus.csv')
    .then(res => res.text())
    .then(text => parseCSV(text));

function parseCSV(text) {
    const lines = text.split('\n');
    const headers = lines[0].split(',');

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i]) continue;
        const values = lines[i].split(',');

        let row = {};
        headers.forEach((h, idx) => row[h.trim()] = values[idx]?.trim());
        cpuData.push(processCPU(row));
    }

    render(cpuData);
}

function processCPU(cpu) {
    cpu.effectiveCores = parseCores(cpu.Cores);
    cpu.maxClock = parseClock(cpu.Clock);
    return cpu;
}

function parseCores(value) {
    if (!value) return 0;
    if (value.includes('/')) {
        const parts = value.split('/').map(v => parseInt(v));
        return Math.max(...parts);
    }
    return parseInt(value);
}

function parseClock(value) {
    if (!value) return 0;
    if (value.includes('to')) {
        return parseFloat(value.split('to')[1]);
    }
    if (value.includes('MHz')) {
        return parseFloat(value) / 1000;
    }
    return parseFloat(value);
}

function render(data) {
    const table = document.getElementById('cpu-table');
    table.innerHTML = '';

    data.forEach(cpu => {
        table.innerHTML += 
            <tr>
                <td>${cpu.Name}</td>
                <td>${cpu.maxClock || '—'}</td>
                <td>${cpu.effectiveCores || '—'}</td>
                <td>${cpu.TDP || '—'}</td>
                <td>${cpu.L3_Cache || '—'}</td>
                <td>${cpu.Socket || '—'}</td>
            </tr>
        ;
    });
}

document.getElementById('search').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    render(cpuData.filter(c => c.Name.toLowerCase().includes(q)));
});