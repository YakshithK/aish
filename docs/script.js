document.addEventListener('DOMContentLoaded', () => {
  const copyBtn = document.getElementById('copy-install');
  if (copyBtn) {
    const copiedLabel = copyBtn.querySelector('.btn-copied');
    copyBtn.addEventListener('click', async () => {
      const command = copyBtn.dataset.command;
      let copied = false;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(command);
          copied = true;
        } catch (err) {
          // Fall through to the execCommand fallback below.
        }
      }
      if (!copied) {
        try {
          const textarea = document.createElement('textarea');
          textarea.value = command;
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.select();
          copied = document.execCommand('copy');
          document.body.removeChild(textarea);
        } catch (err) {
          copied = false;
        }
      }
      if (copied) {
        copyBtn.classList.add('is-copied');
        if (copiedLabel) copiedLabel.textContent = 'copied';
        setTimeout(() => {
          copyBtn.classList.remove('is-copied');
          if (copiedLabel) copiedLabel.textContent = '';
        }, 1500);
      } else {
        console.warn('aish: clipboard copy failed; command text is still visible on the button');
      }
    });
  }

  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    revealEls.forEach((el) => observer.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-visible'));
  }
});
