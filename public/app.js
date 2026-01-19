let transactions = [];
let interestRate = 5; // ต่อเดือน
let chartInstance = null;

// Initial Load
document.addEventListener('DOMContentLoaded', fetchData);

async function fetchData() {
    const response = await fetch('/api/loans');
    transactions = await response.json();
    updateUI();
}

function updateUI() {
    const tbody = document.getElementById('transaction-body');
    tbody.innerHTML = '';
    
    let bal = 0, interest = 0, payment = 0;
    
    transactions.forEach(t => {
        if (t.type === 'เพิ่ม') bal += t.amount;
        if (t.type === 'ลด') { bal -= t.amount; payment += t.amount; }
        if (t.type === 'ดอกเบี้ย') { bal += t.amount; interest += t.amount; }

        tbody.innerHTML += `
            <tr class="border-b hover:bg-gray-50">
                <td class="p-4">${t.date}</td>
                <td class="p-4"><span class="px-2 py-1 rounded-full text-xs ${getTypeClass(t.type)}">${t.type}</span></td>
                <td class="p-4 ${t.type === 'ลด' ? 'text-green-600' : 'text-red-600'}">${t.amount.toLocaleString()}</td>
                <td class="p-4 font-semibold">${t.balance.toLocaleString()}</td>
                <td class="p-4 text-gray-500">${t.notes || '-'}</td>
            </tr>
        `;
    });

    document.getElementById('total-balance').innerText = `${bal.toLocaleString()} บาท`;
    document.getElementById('total-interest').innerText = `${interest.toLocaleString()} บาท`;
    document.getElementById('total-payment').innerText = `${payment.toLocaleString()} บาท`;
    
    updateChart();
}

function getTypeClass(type) {
    if (type === 'เพิ่ม') return 'bg-red-100 text-red-600';
    if (type === 'ลด') return 'bg-green-100 text-green-600';
    return 'bg-orange-100 text-orange-600';
}

async function saveTransaction(type) {
    const amount = parseFloat(document.getElementById('form-amount').value);
    const date = document.getElementById('form-date').value;
    const notes = document.getElementById('form-notes').value;

    if (!amount || !date) return alert('กรุณากรอกข้อมูลให้ครบ');

    // คำนวณ Balance ล่าสุด
    const lastBalance = transactions.length > 0 ? transactions[0].balance : 0;
    const newBalance = (type === 'ลด') ? lastBalance - amount : lastBalance + amount;

    const payload = {
        date,
        type,
        amount,
        balance: newBalance,
        interest: 0,
        notes
    };

    await fetch('/api/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    closeModal();
    fetchData();
}

// ระบบคำนวณดอกเบี้ย (คิด 5% จากยอดคงเหลือปัจจุบัน)
async function calculateMonthlyInterest() {
    if (transactions.length === 0) return alert('ยังไม่มีข้อมูลการกู้');
    const lastBalance = transactions[0].balance;
    const interestCharge = (lastBalance * interestRate) / 100;
    
    if (confirm(`ระบบจะคิดดอกเบี้ย ${interestRate}% จากยอด ${lastBalance.toLocaleString()} เป็นเงิน ${interestCharge.toLocaleString()} บาท?`)) {
        await fetch('/api/loans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                date: new Date().toISOString().split('T')[0],
                type: 'ดอกเบี้ย',
                amount: interestCharge,
                balance: lastBalance + interestCharge,
                interest: interestCharge,
                notes: `ดอกเบี้ยประจำเดือน (${interestRate}%)`
            })
        });
        fetchData();
    }
}

// ฟังก์ชันสำหรับกราฟ Chart.js
function updateChart() {
    const ctx = document.getElementById('loanChart').getContext('2d');
    const last6Months = transactions.slice(0, 10).reverse();
    
    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: last6Months.map(t => t.date),
            datasets: [{
                label: 'ยอดหนี้คงเหลือ',
                data: last6Months.map(t => t.balance),
                borderColor: '#2563eb',
                tension: 0.4,
                fill: true,
                backgroundColor: 'rgba(37, 99, 235, 0.1)'
            }]
        },
        options: { responsive: true, plugins: { legend: { display: false } } }
    });
}

// Modal Control
function openModal(mode) {
    const modal = document.getElementById('modal-backdrop');
    const title = document.getElementById('modal-title');
    const btn = document.getElementById('save-btn');
    
    modal.classList.remove('hidden');
    document.getElementById('form-date').valueAsDate = new Date();

    if (mode === 'add') {
        title.innerText = 'เพิ่มยอดกู้';
        btn.onclick = () => saveTransaction('เพิ่ม');
    } else if (mode === 'sub') {
        title.innerText = 'ลดยอดกู้ / ชำระคืน';
        btn.onclick = () => saveTransaction('ลด');
    }
}

function closeModal() {
    document.getElementById('modal-backdrop').classList.add('hidden');
}