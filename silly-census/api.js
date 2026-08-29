// 1. CONFIGURATION
const SUPABASE_URL = 'https://argeyfcbyhgrsiobsoko.supabase.co/';
const SUPABASE_KEY = 'sb_publishable_h8uJKRKLrEtv249ProXrCQ_CbW0yYwZ';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Custom Chart.js Plugin to draw labels inside the bars
const insideLabelsPlugin = {
    id: 'insideLabelsPlugin',
    afterDatasetsDraw(chart) {
        const { ctx, data, scales: { x, y } } = chart;
        ctx.save();
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 14px sans-serif';
        
        chart.getDatasetMeta(0).data.forEach((bar, index) => {
            const label = data.labels[index];
            const xPos = x.getPixelForValue(0) + 10; // 10px from the left edge
            ctx.fillStyle = '#ffffff'; // White text inside the bar
            ctx.fillText(label, xPos, bar.y + 1); // +1px for visual center alignment
        });
        ctx.restore();
    }
};

// 2. HELPER FUNCTIONS
function cleanUrlError(message) {
    loadToast(message);
    const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
    window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
    
    const title = document.getElementById('title');
    const form = document.getElementById('code-entry-form');
    const content = document.getElementById('census-content');

    if (title) title.textContent = 'enter your form code in!';
    if (form) form.style.display = 'block';
    
    if (content) {
        content.innerHTML = `
            <div style="text-align: center; margin-top: 30px;">
                <button type="button" class="submit-census-btn" onclick="window.location.href='index.html'">Go Back</button>
            </div>
        `;
    }
}

function enterForm(code) {
    if (!code || !code.trim()) {
        loadToast('Please enter a valid form code.');
        return;
    }
    window.location.search = `?id=${encodeURIComponent(code.trim().toUpperCase())}`;
}

// 3. MAIN INITIALIZATION
document.addEventListener('DOMContentLoaded', async () => {
    const fiveDaysAgo = new Date(Date.now() - (5 * 24 * 60 * 60 * 1000)).toISOString();
    await db.from('censuses').delete().lt('release_date', fiveDaysAgo);

    const urlParams = new URLSearchParams(window.location.search);
    const formCode = urlParams.get('id');

    if (formCode) {
        await loadCensusView(formCode.toUpperCase());
    }
});

function getTimeRemaining(releaseDateIso) {
    const diff = new Date(releaseDateIso).getTime() - Date.now();
    if (diff <= 0) return 'a few moments';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    const parts = [];
    if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
    if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
    if (minutes > 0 || parts.length === 0) parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);

    return parts.join(', ');
}

async function loadCensusView(code) {
    const { data: census, error } = await db.from('censuses').select('*').eq('id', code).single();

    if (error || !census) {
        cleanUrlError('Invalid game code! Census not found.');
        return;
    }

    const releaseTime = new Date(census.release_date).getTime();
    const fiveDaysInMillis = 5 * 24 * 60 * 60 * 1000;

    if (Date.now() > releaseTime + fiveDaysInMillis) {
        await db.from('censuses').delete().eq('id', code);
        cleanUrlError('This census has expired and been removed.');
        return;
    }

    const entryForm = document.getElementById('code-entry-form');
    const title = document.getElementById('title');
    const contentDiv = document.getElementById('census-content');

    if (entryForm) entryForm.style.display = 'none';
    if (title) title.textContent = `Silly Census #${census.id}`;
    if (contentDiv) contentDiv.innerHTML = '';

    if (Date.now() >= releaseTime) {
        await renderGraphResults(census, contentDiv);
    } else {
        renderAnsweringGridForm(census, contentDiv);
    }
}

function renderAnsweringGridForm(census, container) {
    const answered = JSON.parse(localStorage.getItem('answered_censuses') || '[]');
    const form = document.createElement('form');
    form.id = 'active-survey-form';

    if (answered.includes(census.id)) {
        const timeRemaining = getTimeRemaining(census.release_date);
        form.innerHTML = `
            <h2>You have already answered this census!</h2>
            <p>The results will be made public in <strong>${timeRemaining}</strong>.</p>
            <button type="button" class="buttonStyle" style="margin-top: 20px;" onclick="window.location.href='../silly-census/'">Back to Home</button>
        `;
        container.appendChild(form);
        return;
    }

    census.questions.forEach((q, idx) => {
        const qDiv = document.createElement('div');
        qDiv.className = 'question-card';
        
        const isReq = q.required ? ' *' : '';
        const maxText = (q.type === 'friend_select' && q.maxSelect > 1) ? ` (Select up to ${q.maxSelect})` : '';

        qDiv.innerHTML = `<p class="question-title"><strong>${idx + 1}. ${q.text}${isReq}${maxText}</strong></p>`;

        if (q.type === 'friend_select') {
            const grid = document.createElement('div');
            grid.className = 'friends-checkbox-grid';

            census.friends.forEach(friend => {
                const label = document.createElement('label');
                label.className = 'checkbox-card';

                const input = document.createElement('input');
                input.type = 'checkbox';
                input.className = 'census-checkbox';
                input.name = `q_${idx}`;
                input.value = friend;

                input.addEventListener('change', () => {
                    const checkedCount = grid.querySelectorAll(`input[name="q_${idx}"]:checked`).length;
                    if (checkedCount > (q.maxSelect || 1)) {
                        input.checked = false;
                        loadToast(`You can only select up to ${q.maxSelect || 1} friend(s) here!`);
                    }
                });

                const customBox = document.createElement('span');
                customBox.className = 'checkbox-custom';

                const labelText = document.createElement('span');
                labelText.className = 'checkbox-label';
                labelText.textContent = friend;

                label.appendChild(input);
                label.appendChild(customBox);
                label.appendChild(labelText);
                grid.appendChild(label);
            });
            qDiv.appendChild(grid);
        } else {
            const textInput = document.createElement('input');
            textInput.type = 'text';
            textInput.className = 'text-answer-input';
            textInput.name = `q_${idx}`;
            if (q.required) textInput.required = true;
            qDiv.appendChild(textInput);
        }

        form.appendChild(qDiv);
    });

    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'submit-census-btn';
    submitBtn.textContent = 'Submit Answers';
    form.appendChild(submitBtn);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const answers = {};

        for (let idx = 0; idx < census.questions.length; idx++) {
            const q = census.questions[idx];
            const qKey = `q_${idx}`;

            if (q.type === 'friend_select') {
                const selected = Array.from(form.querySelectorAll(`input[name="${qKey}"]:checked`)).map(c => c.value);
                if (q.required && selected.length === 0) {
                    loadToast(`Hold up! You missed question ${idx + 1}.`);
                    return;
                }
                answers[qKey] = selected;
            } else {
                const val = form.elements[qKey].value.trim();
                if (q.required && !val) {
                    loadToast(`Hold up! You missed question ${idx + 1}.`);
                    return;
                }
                answers[qKey] = val;
            }
        }

        const { error } = await db.from('responses').insert([{ census_id: census.id, answers: answers }]);

        if (error) {
            loadToast('Submission failed: ' + error.message);
        } else {
            answered.push(census.id);
            localStorage.setItem('answered_censuses', JSON.stringify(answered));
            const timeRemaining = getTimeRemaining(census.release_date);
            form.innerHTML = `
                <h2>Thank you! Your answers have been recorded.</h2>
                <p>The results will be made public in <strong>${timeRemaining}</strong>.</p>
            `;
        }
    });

    container.appendChild(form);
}

async function renderGraphResults(census, container) {
    const { data: responses, error } = await db.from('responses').select('*').eq('census_id', census.id);

    const form = document.createElement('form');
    form.id = 'active-survey-form';
    form.className = 'census-results-form';

    if (error || !responses || responses.length === 0) {
        form.innerHTML = '<h2>Census Closed - Final Results</h2><p>No responses were submitted for this census.</p>';
        container.appendChild(form);
        return;
    }

    const titleHeader = document.createElement('h2');
    titleHeader.textContent = 'Census Closed - Final Results';
    form.appendChild(titleHeader);

    census.questions.forEach((q, idx) => {
        const qKey = `q_${idx}`;
        
        const qCard = document.createElement('div');
        qCard.className = 'result-card';
        qCard.style.marginBottom = '30px';
        qCard.innerHTML = `<h3>${idx + 1}. ${q.text}</h3>`;

        // Check if Text Response Type
        if (q.type === 'text') {
            const listDiv = document.createElement('div');
            listDiv.style.marginTop = '10px';
            listDiv.style.display = 'flex';
            listDiv.style.flexDirection = 'column';
            listDiv.style.gap = '8px';

            let hasAnswers = false;
            responses.forEach(r => {
                const ans = r.answers[qKey];
                if (ans && ans.trim() !== '') {
                    hasAnswers = true;
                    const p = document.createElement('div');
                    p.style.padding = '10px';
                    p.style.backgroundColor = 'rgba(191, 8, 17, 0.1)';
                    p.style.border = '1px solid var(--main, #bf0811)';
                    p.style.borderRadius = '5px';
                    p.style.color = '#111';
                    p.textContent = ans;
                    listDiv.appendChild(p);
                }
            });

            if (!hasAnswers) {
                listDiv.innerHTML = '<p>No written answers.</p>';
            }
            
            qCard.appendChild(listDiv);
            form.appendChild(qCard);
            return; // Skip chart rendering for text fields
        }

        // --- Chart Rendering for Friend Selects ---
        const counts = {};
        responses.forEach(r => {
            const ans = r.answers[qKey];
            if (Array.isArray(ans)) {
                ans.forEach(val => { counts[val] = (counts[val] || 0) + 1; });
            }
        });

        // Smaller chart height
        const chartWrapper = document.createElement('div');
        chartWrapper.style.position = 'relative';
        chartWrapper.style.height = '180px'; // Made graph smaller
        chartWrapper.style.width = '100%';
        
        const canvas = document.createElement('canvas');
        canvas.id = `chart-${idx}`;
        
        chartWrapper.appendChild(canvas);
        qCard.appendChild(chartWrapper);
        form.appendChild(qCard);

        const labels = Object.keys(counts);
        const dataValues = Object.values(counts);

        if (labels.length === 0) {
            qCard.innerHTML += '<p>No answers recorded for this question.</p>';
            return;
        }

        if (typeof Chart !== 'undefined') {
            new Chart(canvas, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Votes',
                        data: dataValues,
                        backgroundColor: '#bf0811', 
                        borderWidth: 0,
                        borderRadius: 4
                    }]
                },
                plugins: [insideLabelsPlugin], // Call our custom plugin
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            display: false // Hide outside names
                        },
                        x: { 
                            beginAtZero: true, 
                            ticks: { stepSize: 1 } 
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: { enabled: true }
                    }
                }
            });
        }
    });

    container.appendChild(form);
}