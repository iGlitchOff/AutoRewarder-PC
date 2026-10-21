// =========================================================================
// Accounts management modal — list rendering + per-account actions.
// The generic toast / modal / avatar helpers live in script.js.
// =========================================================================

const ACCOUNT_ICONS = {
  rename: '<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>',
  setup:  '<svg viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15A9 9 0 1 1 18 5.3L23 10"/></svg>',
  trash:  '<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>',
};

function render_accounts_section(accounts) {
  const list = document.getElementById('accounts_list');
  if (!list) return;

  list.innerHTML = '';

  if (!accounts || accounts.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'accounts-empty';
    empty.textContent = t('accounts.empty_modal');
    list.appendChild(empty);
    return;
  }

  for (const acc of accounts) {
    const item = document.createElement('li');
    item.className = 'account-item' + (acc.is_current ? ' current' : '');

    item.appendChild(make_avatar(acc));

    const info = document.createElement('div');
    info.className = 'account-item-info';
    const name = document.createElement('div');
    name.className = 'account-item-name';
    name.textContent = acc.label;
    const meta = document.createElement('div');
    meta.className = 'account-item-meta';
    meta.textContent =
      (acc.is_current ? t('account.current') : '') +
      (acc.first_setup_done ? t('account.ready') : t('account.setup_pending'));
    info.appendChild(name);
    info.appendChild(meta);
    item.appendChild(info);

    const actions = document.createElement('div');
    actions.className = 'account-actions';

    const renameBtn = document.createElement('button');
    renameBtn.className = 'icon-btn';
    renameBtn.title = t('account.rename');
    renameBtn.setAttribute('aria-label', t('account.rename'));
    renameBtn.innerHTML = ACCOUNT_ICONS.rename;
    renameBtn.addEventListener('click', async () => {
      const newLabel = await prompt_modal(
        t('account.rename_title'),
        tf('account.rename_prompt', { name: acc.label }),
        acc.label,
        { confirmLabel: t('account.rename') }
      );
      if (newLabel === null) return;
      const trimmed = String(newLabel).trim();
      if (!trimmed) return;
      pywebview.api.rename_account(acc.id, trimmed).then(ok => {
        if (!ok) show_toast(t('account_rename_failed'), 'error');
        else show_toast(tf('account_renamed', { name: trimmed }), 'success');
      });
    });

    const resetupBtn = document.createElement('button');
    resetupBtn.className = 'icon-btn';
    resetupBtn.title = acc.first_setup_done ? t('account.rerun_setup') : t('account.run_setup');
    resetupBtn.setAttribute('aria-label', resetupBtn.title);
    resetupBtn.innerHTML = ACCOUNT_ICONS.setup;
    resetupBtn.addEventListener('click', () => {
      show_toast(tf('account.opening_setup', { name: acc.label }), 'info', { duration: 6000 });
      pywebview.api.rerun_setup(acc.id).then(ok => {
        if (!ok) show_toast(t('account_setup_failed_start'), 'error');
      });
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'icon-btn danger';
    deleteBtn.title = t('account.delete');
    deleteBtn.setAttribute('aria-label', t('account.delete'));
    deleteBtn.innerHTML = ACCOUNT_ICONS.trash;
    deleteBtn.addEventListener('click', async () => {
      const confirmed = await confirm_modal(
        tf('account.delete_question', { name: acc.label }),
        t('account.delete_msg'),
        { confirmLabel: t('account.delete'), danger: true }
      );
      if (!confirmed) return;
      pywebview.api.delete_account(acc.id).then(success => {
        if (!success) show_toast(t('account_delete_failed'), 'error');
        else show_toast(tf('account_deleted_named', { name: acc.label }), 'success');
      });
    });

    actions.appendChild(resetupBtn);
    actions.appendChild(renameBtn);
    actions.appendChild(deleteBtn);
    item.appendChild(actions);

    list.appendChild(item);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const addBtn = document.getElementById('addAccountBtn');
  if (addBtn) addBtn.addEventListener('click', prompt_and_create_account);
});
