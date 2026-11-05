/**
 * E-246 Dashboard — ProBot-grade Interactive Client Engine
 * Handles AJAX auto-saving, toast notifications, switch events, and live variable insertion.
 */

// Toast Notification Manager
window.showToast = function (message, type = 'success', duration = 3500) {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `pro-toast pro-toast-${type}`;

  let iconHtml = '<i class="fa-solid fa-circle-check pro-toast-icon"></i>';
  if (type === 'error') {
    iconHtml = '<i class="fa-solid fa-circle-exclamation pro-toast-icon"></i>';
  } else if (type === 'info') {
    iconHtml = '<i class="fa-solid fa-circle-info pro-toast-icon"></i>';
  }

  toast.innerHTML = `
        ${iconHtml}
        <span class="pro-toast-msg">${message}</span>
    `;

  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  // Auto dismiss
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, duration);
};

// Variable Pill Click Handler
document.addEventListener('click', (e) => {
  const pill = e.target.closest('.var-pill');
  if (!pill) return;

  const variableTag = pill.getAttribute('data-var');
  const targetId = pill.getAttribute('data-target') || 'message';
  const targetInput = document.getElementById(targetId);

  if (targetInput && variableTag) {
    const start = targetInput.selectionStart || targetInput.value.length;
    const end = targetInput.selectionEnd || targetInput.value.length;
    const text = targetInput.value;

    targetInput.value = text.substring(0, start) + variableTag + text.substring(end);
    targetInput.focus();
    targetInput.selectionStart = targetInput.selectionEnd = start + variableTag.length;

    // Trigger input event for live preview if attached
    targetInput.dispatchEvent(new Event('input', { bubbles: true }));

    window.showToast(`تم إدراج المتغير ${variableTag}`, 'info', 2000);
  }
});

// AJAX Form Handler for Smooth Submissions
document.addEventListener('DOMContentLoaded', () => {
  const forms = document.querySelectorAll('form.settings-form, form[data-ajax="true"]');

  forms.forEach((form) => {
    form.addEventListener('submit', async (e) => {
      // Check if caller wants native submit
      if (form.getAttribute('data-native-submit') === 'true') return;

      e.preventDefault();
      const submitBtn = form.querySelector('button[type="submit"]');
      let originalBtnHtml = '';
      if (submitBtn) {
        originalBtnHtml = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> جاري الحفظ...';
      }

      try {
        const formData = new FormData(form);
        const urlEncoded = new URLSearchParams();
        for (const [key, value] of formData.entries()) {
          urlEncoded.append(key, value);
        }

        const response = await fetch(form.action, {
          method: form.method || 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: urlEncoded.toString()
        });

        if (response.ok) {
          let data = {};
          try {
            data = await response.json();
          } catch (_) {
            // ignore non-json response
          }

          window.showToast(data.message || 'تم حفظ جميع التغييرات بنجاح ⚡', 'success');

          // If floating save bar is open, hide it
          const saveBar = document.getElementById('floatingSaveBar');
          if (saveBar) saveBar.classList.remove('active');
        } else {
          window.showToast('تعذر حفظ الإعدادات، يرجى المحاولة مرة أخرى', 'error');
        }
      } catch (err) {
        console.error('[Dashboard AJAX Save Error]:', err); // eslint-disable-line no-console
        window.showToast('حدث خطأ في الاتصال بالخادم أثناء الحفظ', 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnHtml;
        }
      }
    });
  });

  // Auto-save on specific toggle switches marked with data-autosave="true"
  document.querySelectorAll('.pro-switch input[data-autosave="true"]').forEach((sw) => {
    sw.addEventListener('change', () => {
      const form = sw.closest('form');
      if (form) {
        form.dispatchEvent(new Event('submit', { cancelable: true }));
      }
    });
  });

  // Guild Cards Search and Filter Engine
  const searchInput = document.getElementById('guildSearchInput');
  const filterPills = document.querySelectorAll('.filter-pill');
  const guildCards = document.querySelectorAll('#guildGrid .guild-card');
  const countBadge = document.getElementById('visibleGuildsCount');
  const noResultsBox = document.getElementById('noSearchResults');

  if (searchInput || filterPills.length > 0) {
    let currentFilter = 'all';

    const updateGuildFilter = () => {
      const query = (searchInput ? searchInput.value : '').trim().toLowerCase();
      let visibleCount = 0;

      guildCards.forEach((card) => {
        const name = (card.getAttribute('data-name') || '').toLowerCase();
        const status = card.getAttribute('data-status') || '';

        const matchesQuery = !query || name.includes(query);
        const matchesStatus =
          currentFilter === 'all' ||
          (currentFilter === 'active' && status === 'active') ||
          (currentFilter === 'inactive' && status === 'inactive');

        if (matchesQuery && matchesStatus) {
          card.style.display = '';
          visibleCount++;
        } else {
          card.style.display = 'none';
        }
      });

      if (countBadge) {
        countBadge.textContent = String(visibleCount);
      }

      if (noResultsBox) {
        noResultsBox.style.display = visibleCount === 0 ? 'block' : 'none';
      }
    };

    if (searchInput) {
      searchInput.addEventListener('input', updateGuildFilter);
    }

    filterPills.forEach((pill) => {
      pill.addEventListener('click', () => {
        filterPills.forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        currentFilter = pill.getAttribute('data-filter') || 'all';
        updateGuildFilter();
      });
    });
  }
});
