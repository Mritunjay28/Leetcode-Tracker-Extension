// popup.js for LeetCode Tracker Chrome Extension

document.addEventListener('DOMContentLoaded', function () {
  const storageKey = 'leetcode_problems';

  const form = document.getElementById('problemForm');
  const list = document.getElementById('problemList');
  const message = document.getElementById('message');
  const exportBtn = document.getElementById('exportCSV');
  const tabs = {
    today: document.getElementById('viewToday'),
    all: document.getElementById('viewAll'),
    learned: document.getElementById('viewLearned')
  };

  const stageOrder = ['spaced-1', 'spaced-2', 'spaced-3', 'spaced-4', 'spaced-5'];
  const stageIntervals = {
    'spaced-1': 1, 'spaced-2': 3, 'spaced-3': 7, 'spaced-4': 14, 'spaced-5': 30
  };

  function getToday() {
    return new Date().toISOString().slice(0, 10);
  }

  function getNextStage(stage) {
    const idx = stageOrder.indexOf(stage);
    return idx === stageOrder.length - 1 ? 'spaced-1' : stageOrder[idx + 1];
  }

  function getNextDate(stage) {
    const d = new Date();
    d.setDate(d.getDate() + stageIntervals[stage]);
    return d.toISOString().slice(0, 10);
  }

  function showMessage(text) {
    message.textContent = text;
    message.style.opacity = 1;
    setTimeout(() => { message.style.opacity = 0; }, 3000);
  }

  function loadProblems(callback) {
    chrome.storage.local.get([storageKey], function(result) {
      const data = result[storageKey] || [];
      callback(data);
    });
  }

  function saveProblems(data, callback) {
    chrome.storage.local.set({ [storageKey]: data }, function () {
      console.log("✅ Data saved:", data);
      if (callback) callback();
    });
  }

  function render(view = 'today') {
    loadProblems(function(data) {
      const today = getToday();
      list.innerHTML = '';

      const filtered = data.filter(p =>
        view === 'all' ? p.status !== 'learned' :
        view === 'learned' ? p.status === 'learned' :
        p.nextReview === today && p.status !== 'learned'
      );

      filtered.sort((a, b) => new Date(a.nextReview) - new Date(b.nextReview));

      for (let i = 0; i < filtered.length; i++) {
        const p = filtered[i];
        const item = document.createElement('div');
        item.className = 'problem-card';
        item.innerHTML = `
          <div class="problem-header">
            <strong><a href="${p.link}" target="_blank">${p.title}</a></strong>
            <p>${p.topic} • ${p.difficulty}</p>
            <small>
              ${p.status === 'learned' 
                ? 'Status: 🎓 Learned' 
                : `Stage: ${p.stage} | Next: ${p.nextReview} | Status: ${p.status}`}
            </small>
          </div>
          <div class="problem-buttons">
            <button class="btn-review" data-id="${p.id}">✅ Review</button>
            <button class="btn-redo" data-id="${p.id}">🔁 Redo</button>
            <button class="btn-learned" data-id="${p.id}">🎓 Learned</button>
            <button class="btn-approach" data-id="${p.id}">💡 Show Approach</button>
            <button class="btn-delete" data-id="${p.id}">🗑️ Delete</button>
          </div>
          <div class="problem-approach" style="display:none;">${p.approach || 'No approach added yet.'}</div>
        `;
        list.appendChild(item);
      }
    });
  }

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      const title = document.getElementById('title').value.trim();
      const link = document.getElementById('link').value.trim();
      const topic = document.getElementById('topic').value.trim();
      const difficulty = document.getElementById('difficulty').value;
      const approach = document.getElementById('approach').value.trim();

      if (!title) return;

      loadProblems(function(data) {
        const newEntry = {
          id: Date.now(),
          title,
          link,
          topic,
          difficulty,
          approach,
          stage: 'spaced-1',
          nextReview: getNextDate('spaced-1'),
          status: 'active',
          history: [{ date: getToday(), action: 'Added' }]
        };

        data.push(newEntry);
        saveProblems(data, () => {
          form.reset();
          showMessage(`🆕 Added: "${newEntry.title}"`);
          render(currentView);
        });
      });
    });
  }

  list.addEventListener('click', function (e) {
    const id = e.target.dataset.id;
    if (!id) return;

    loadProblems(function(data) {
      const index = data.findIndex(p => p.id == id);
      if (index === -1) return;

      if (e.target.classList.contains('btn-review')) {
        const p = data[index];
        p.stage = getNextStage(p.stage);
        p.nextReview = getNextDate(p.stage);
        p.history.push({ date: getToday(), action: 'Reviewed' });
        showMessage(`✅ Reviewed. Next: ${p.nextReview}`);
      }

      if (e.target.classList.contains('btn-redo')) {
        const p = data[index];
        p.status = 'active';
        p.stage = 'spaced-1';
        p.nextReview = getNextDate('spaced-1');
        p.history.push({ date: getToday(), action: 'Redo from Learned' });
        showMessage(`🔁 Re-added to review. Next: ${p.nextReview}`);
      }

      if (e.target.classList.contains('btn-learned')) {
        data[index].status = 'learned';
        data[index].history.push({ date: getToday(), action: 'Learned' });
        showMessage(`🎓 Marked as Learned`);
      }

    if (e.target.classList.contains('btn-approach')) {
  const card = e.target.closest('.problem-card');
  const approachDiv = card.querySelector('.problem-approach');
  const showing = approachDiv.style.display === 'block';
  approachDiv.style.display = showing ? 'none' : 'block';
  e.target.textContent = showing ? '💡 Show Approach' : '🙈 Hide Approach';
  return; // ❌ Skip re-rendering here
}

      if (e.target.classList.contains('btn-delete')) {
        const confirmed = confirm("Are you sure you want to delete this problem?");
        if (confirmed) {
          data.splice(index, 1);
          saveProblems(data, () => {
            showMessage("🗑️ Problem deleted.");
            render(currentView);
          });
          return;
        }
      }

      saveProblems(data, () => render(currentView));
    });
  });

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const tab = tabs[0];
    if (tab.url.includes('leetcode.com/problems')) {
      chrome.tabs.sendMessage(tab.id, 'getProblemInfo', function (response) {
        if (chrome.runtime.lastError) {
          console.error("❌ content.js not loaded:", chrome.runtime.lastError.message);
          alert("Auto-fill failed: content script didn't respond.");
          return;
        }
        if (response) {
          document.getElementById('title').value = response.title;
          document.getElementById('link').value = response.link;
        }
      });
    }
  });

  if (exportBtn) {
    exportBtn.addEventListener('click', function () {
      loadProblems(function(data) {
        const rows = [['Title', 'Link', 'Topic', 'Difficulty', 'Stage', 'Next Review', 'Status']];
        data.forEach(p => {
          rows.push([p.title, p.link, p.topic, p.difficulty, p.stage, p.nextReview, p.status]);
        });
        const content = rows.map(r => r.join('\t')).join('\n');
        const blob = new Blob([content], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'leetcode_srs.csv';
        link.click();
      });
    });
  }

  let currentView = 'today';

  Object.entries(tabs).forEach(([key, el]) => {
    if (el) {
      el.addEventListener('click', () => {
        const section = document.getElementById('problemList');
        if (currentView === key) {
          section.innerHTML = '';
          currentView = '';
        } else {
          currentView = key;
          render(key);
        }
      });
    }
  });

  render();
});
