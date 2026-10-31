/* AutoRewarder UI strings. Default language is auto (Windows / region). */
const I18N = {
  en: {
    "run.start": "Start run",
    "run.tasks": "Tasks only",
    "run.stop": "Stop",
    "run.running": "Running…",
    "run.loading": "Loading…",
    "run.stopping": "Stopping…",
    "run.no_microsoft": "No Microsoft account selected.",
    "run.microsoft_setup": "Microsoft account setup is not finished.",
    "run.already_running": "A run is already in progress.",
    "run.browser_loading": "Wait for the browser to finish loading.",
    "run.browser_busy": "Wait for the browser to finish.",
    "run.phone_offline": "No phone linked, or the phone is offline.",
    "run.no_phone": "No phone linked to this Microsoft account.",
    "pair.title": "Link a phone",
    "pair.hint": "On the phone, enter or scan this code. The phone finds this PC by itself (remote tunnel). Same Microsoft account — not a second login.",
    "pair.copy": "Copy code",
    "pair.copied": "Code copied.",
    "pair.waiting": "Starting remote link…",
    "pair.ready": "Scan the QR or type the code on the phone.",
    "settings.language": "Language",
    "settings.language_hint": "Automatic uses Windows / region. Applies to this PC and the linked phone.",
    "settings.language_auto": "Automatic (Windows / region)",
    "settings.language_en": "English",
    "settings.language_es": "Spanish",
    "settings.language_pt": "Portuguese",
    "settings.language_zh": "Chinese",
    "label.pc": "PC",
    "label.mobile": "Mobile",
    "status.daily": "Daily tasks",
    "rewards.estimate": "Search estimate",
    "rewards.region_unknown": "Region unknown",
    "rewards.unverified": "Not verified",
    "progress.daily": "Daily",
    "progress.visual": "Visual",
    "progress.checkin": "Check-in",
    "progress.news": "News",
    "progress.edge": "Edge",
    "progress.reset": "Daily set",
    "activity": "Activity",
    "history": "View history",
  },
  es: {
    "run.start": "Iniciar",
    "run.tasks": "Solo tareas",
    "run.stop": "Parar",
    "run.running": "Ejecutando…",
    "run.loading": "Cargando…",
    "run.stopping": "Parando…",
    "run.no_microsoft": "No hay cuenta Microsoft seleccionada.",
    "run.microsoft_setup": "Falta terminar el setup de la cuenta Microsoft.",
    "run.already_running": "Ya hay una ejecución en curso.",
    "run.browser_loading": "Espera a que termine de cargar el navegador.",
    "run.browser_busy": "Espera a que el navegador termine.",
    "run.phone_offline": "No hay celular vinculado, o está desconectado.",
    "run.no_phone": "No hay celular vinculado a esta cuenta Microsoft.",
    "pair.title": "Vincular un celular",
    "pair.hint": "En el celular, escribe o escanea este código. El teléfono encuentra este PC solo (túnel remoto). Misma cuenta Microsoft — no es un segundo inicio de sesión.",
    "pair.copy": "Copiar código",
    "pair.copied": "Código copiado.",
    "pair.waiting": "Preparando enlace remoto…",
    "pair.ready": "Escanea el QR o escribe el código en el celular.",
    "settings.language": "Idioma",
    "settings.language_hint": "Automático usa Windows / región. Aplica a este PC y al celular vinculado.",
    "settings.language_auto": "Automático (Windows / región)",
    "settings.language_en": "Inglés",
    "settings.language_es": "Español",
    "settings.language_pt": "Portugués",
    "settings.language_zh": "Chino",
    "label.pc": "PC",
    "label.mobile": "Móvil",
    "status.daily": "Tareas del día",
    "rewards.estimate": "Estimado de búsquedas",
    "rewards.region_unknown": "Región desconocida",
    "rewards.unverified": "No verificado",
    "progress.daily": "Diarias",
    "progress.visual": "Visual",
    "progress.checkin": "Check-in",
    "progress.news": "Noticias",
    "progress.edge": "Edge",
    "progress.reset": "Tareas del día",
    "activity": "Actividad",
    "history": "Ver historial",
  },
};

I18N.pt = {
  ...I18N.en,
  "run.start": "Iniciar execução", "run.tasks": "Somente tarefas", "run.stop": "Parar",
  "run.running": "Executando…", "run.loading": "Carregando…", "run.stopping": "Parando…",
  "run.no_microsoft": "Nenhuma conta Microsoft selecionada.", "run.microsoft_setup": "A configuração da conta Microsoft não terminou.",
  "run.already_running": "Já existe uma execução em andamento.", "run.browser_loading": "Aguarde o navegador terminar de carregar.",
  "run.browser_busy": "Aguarde o navegador terminar.", "run.phone_offline": "Nenhum celular vinculado ou o celular está offline.",
  "run.no_phone": "Nenhum celular vinculado a esta conta Microsoft.", "pair.title": "Vincular um celular",
  "pair.hint": "No celular, digite ou escaneie este código. O celular encontra este PC sozinho. Mesma conta Microsoft, não é um segundo login.",
  "pair.copy": "Copiar código", "pair.copied": "Código copiado.", "pair.waiting": "Iniciando vínculo remoto…",
  "pair.ready": "Escaneie o QR ou digite o código no celular.", "settings.language": "Idioma",
  "settings.language_hint": "Automático usa o Windows / região. Aplica-se a este PC e ao celular vinculado.",
  "settings.language_auto": "Automático (Windows / região)", "settings.language_en": "Inglês", "settings.language_es": "Espanhol",
  "settings.language_pt": "Português", "settings.language_zh": "Chinês", "label.mobile": "Celular",
  "status.daily": "Tarefas diárias", "rewards.estimate": "Estimativa de pesquisas", "rewards.region_unknown": "Região desconhecida",
  "rewards.unverified": "Não verificado", "progress.daily": "Diárias", "progress.visual": "Visual",
  "progress.checkin": "Check-in", "progress.news": "Notícias", "progress.edge": "Edge", "progress.reset": "Conjunto diário",
  "activity": "Atividade", "history": "Ver histórico",
};

I18N.zh = {
  ...I18N.en,
  "run.start": "开始运行", "run.tasks": "仅任务", "run.stop": "停止", "run.running": "运行中…", "run.loading": "加载中…", "run.stopping": "正在停止…",
  "run.no_microsoft": "未选择 Microsoft 帐户。", "run.microsoft_setup": "Microsoft 帐户设置尚未完成。", "run.already_running": "已有任务正在运行。",
  "run.browser_loading": "请等待浏览器加载完成。", "run.browser_busy": "请等待浏览器完成当前操作。", "run.phone_offline": "未连接手机，或手机处于离线状态。",
  "run.no_phone": "此 Microsoft 帐户没有关联手机。", "pair.title": "关联手机", "pair.hint": "在手机上输入或扫描此代码。手机会自动找到这台电脑。使用同一个 Microsoft 帐户。",
  "pair.copy": "复制代码", "pair.copied": "代码已复制。", "pair.waiting": "正在启动远程连接…", "pair.ready": "扫描二维码或在手机上输入代码。",
  "settings.language": "语言", "settings.language_hint": "自动模式使用 Windows / 地区设置。应用于此电脑和已关联的手机。",
  "settings.language_auto": "自动（Windows / 地区）", "settings.language_en": "英语", "settings.language_es": "西班牙语",
  "settings.language_pt": "葡萄牙语", "settings.language_zh": "中文", "label.mobile": "手机", "status.daily": "每日任务",
  "rewards.estimate": "搜索估计", "rewards.region_unknown": "未知地区", "rewards.unverified": "未验证", "progress.daily": "每日",
  "progress.visual": "视觉", "progress.checkin": "签到", "progress.news": "新闻", "progress.edge": "Edge", "progress.reset": "每日任务集",
  "activity": "活动", "history": "查看历史记录",
};

// All visible UI copy lives here. Unlike the original small data-i18n list,
// this table also covers labels produced later by JavaScript and the companion,
// history and dashboard windows. The reverse index below lets a screen start
// in English or Spanish and still change cleanly to any supported language.
const UI_COPY = {
  "app.title": { en: "AutoRewarder", es: "AutoRewarder", pt: "AutoRewarder", zh: "AutoRewarder" },
  "app.companion": { en: "AutoRewarder", es: "AutoRewarder", pt: "AutoRewarder", zh: "AutoRewarder" },
  "settings": { en: "Settings", es: "Configuración", pt: "Configurações", zh: "设置" },
  "general": { en: "General", es: "General", pt: "Geral", zh: "常规" },
  "account": { en: "Account", es: "Cuenta", pt: "Conta", zh: "账户" },
  "accounts": { en: "Your accounts", es: "Tus cuentas", pt: "Suas contas", zh: "你的账户" },
  "add_account": { en: "Add account", es: "Agregar cuenta", pt: "Adicionar conta", zh: "添加账户" },
  "no_accounts": { en: "No accounts yet", es: "Aún no hay cuentas", pt: "Ainda não há contas", zh: "还没有账户" },
  "no_account": { en: "No account", es: "Sin cuenta", pt: "Sem conta", zh: "没有账户" },
  "add_first_account": { en: "Add your first Microsoft account to get started.", es: "Agrega tu primera cuenta Microsoft para comenzar.", pt: "Adicione sua primeira conta Microsoft para começar.", zh: "添加你的第一个 Microsoft 账户即可开始。" },
  "manage_accounts": { en: "Manage accounts", es: "Administrar cuentas", pt: "Gerenciar contas", zh: "管理账户" },
  "delete_account": { en: "Delete this account", es: "Eliminar esta cuenta", pt: "Excluir esta conta", zh: "删除此账户" },
  "close": { en: "Close", es: "Cerrar", pt: "Fechar", zh: "关闭" },
  "cancel": { en: "Cancel", es: "Cancelar", pt: "Cancelar", zh: "取消" },
  "save": { en: "Save", es: "Guardar", pt: "Salvar", zh: "保存" },
  "confirm": { en: "Confirm", es: "Confirmar", pt: "Confirmar", zh: "确认" },
  "download": { en: "Download", es: "Descargar", pt: "Baixar", zh: "下载" },
  "checking": { en: "Checking…", es: "Buscando…", pt: "Verificando…", zh: "正在检查…" },
  "downloading": { en: "Downloading…", es: "Descargando…", pt: "Baixando…", zh: "正在下载…" },
  "update.title": { en: "Updating AutoRewarder", es: "Actualizando AutoRewarder", pt: "Atualizando o AutoRewarder", zh: "正在更新 AutoRewarder" },
  "update.downloading": { en: "Downloading…", es: "Descargando…", pt: "Baixando…", zh: "正在下载…" },
  "update.installing": { en: "Installing", es: "Instalando", pt: "Instalando", zh: "正在安装" },
  "update.replacing": { en: "Replacing old version", es: "Borrando versión vieja", pt: "Substituindo a versão antiga", zh: "正在替换旧版本" },
  "update.cleaning": { en: "Cleaning up", es: "Limpiando archivos anteriores", pt: "Limpando arquivos anteriores", zh: "正在清理旧文件" },
  "update.finished": { en: "Finished", es: "Finalizado", pt: "Finalizado", zh: "已完成" },
  "update.error": { en: "The update could not be installed.", es: "No se pudo instalar la actualización.", pt: "Não foi possível instalar a atualização.", zh: "无法安装更新。" },
  "update.detail": { en: "Please keep AutoRewarder open.", es: "Mantén AutoRewarder abierto.", pt: "Mantenha o AutoRewarder aberto.", zh: "请保持 AutoRewarder 打开。" },
  "check_updates": { en: "Check updates", es: "Buscar actualizaciones", pt: "Verificar atualizações", zh: "检查更新" },
  "run": { en: "Run", es: "Ejecutar", pt: "Executar", zh: "运行" },
  "start_run": { en: "Start run", es: "Iniciar ejecución", pt: "Iniciar execução", zh: "开始运行" },
  "manual_tasks": { en: "Manual tasks", es: "Tareas manuales", pt: "Tarefas manuais", zh: "手动任务" },
  "activity": { en: "Activity", es: "Actividad", pt: "Atividade", zh: "活动" },
  "background_logs": { en: "Background logs", es: "Registros en segundo plano", pt: "Logs em segundo plano", zh: "后台日志" },
  "background_logs.subtitle": { en: "Logs from scheduled and headless runs.", es: "Registros de ejecuciones programadas y ocultas.", pt: "Logs de execuções agendadas e em segundo plano.", zh: "来自计划任务和无头运行的日志。" },
  "settings.manual_delay_title": { en: "Pause between manual searches", es: "Pausa entre búsquedas manuales", pt: "Pausa entre pesquisas manuais", zh: "手动搜索之间的暂停" },
  "settings.manual_delay_hint": { en: "Sets a random pause between search queries during a normal manual run. Does not apply to scheduled runs or Advanced scheduling.", es: "Define una pausa aleatoria entre búsquedas en una ejecución manual normal. No aplica a ejecuciones programadas ni con programación avanzada.", pt: "Define uma pausa aleatória entre pesquisas em uma execução manual normal. Não se aplica a execuções agendadas.", zh: "在正常手动运行期间设置搜索查询之间的随机暂停。不适用于计划运行或高级计划。" },
  "settings.manual_delay_min": { en: "MINIMUM, SECONDS", es: "MÍNIMO, SEGUNDOS", pt: "MÍNIMO, SEGUNDOS", zh: "最小秒数" },
  "settings.manual_delay_max": { en: "MAXIMUM, SECONDS", es: "MÁXIMO, SEGUNDOS", pt: "MÁXIMO, SEGUNDOS", zh: "最大秒数" },
  "stats": { en: "Stats", es: "Estadísticas", pt: "Estatísticas", zh: "统计" },
  "dashboard": { en: "Dashboard", es: "Panel", pt: "Painel", zh: "仪表板" },
  "history": { en: "View history", es: "Ver historial", pt: "Ver histórico", zh: "查看历史记录" },
  "queries": { en: "Queries", es: "Búsquedas", pt: "Pesquisas", zh: "搜索次数" },
  "total_points": { en: "Total points", es: "Puntos totales", pt: "Pontos totais", zh: "总积分" },
  "earned_today": { en: "Earned today", es: "Ganado hoy", pt: "Ganhos hoje", zh: "今日获得" },
  "rewards_overview": { en: "Rewards overview", es: "Resumen de recompensas", pt: "Visão geral das recompensas", zh: "奖励概览" },
  "search_estimate": { en: "Search estimate", es: "Estimado de búsquedas", pt: "Estimativa de pesquisas", zh: "搜索估算" },
  "daily_tasks": { en: "Daily tasks", es: "Tareas diarias", pt: "Tarefas diárias", zh: "每日任务" },
  "ready": { en: "Ready", es: "Listo", pt: "Pronto", zh: "就绪" },
  "ready_to_run": { en: "Ready to run", es: "Listo para ejecutar", pt: "Pronto para executar", zh: "可以运行" },
  "setup_pending": { en: "Setup pending", es: "Configuración pendiente", pt: "Configuração pendente", zh: "等待设置" },
  "loading": { en: "Loading…", es: "Cargando…", pt: "Carregando…", zh: "正在加载…" },
  "detecting": { en: "Detecting…", es: "Detectando…", pt: "Detectando…", zh: "正在检测…" },
  "membership_unavailable": { en: "Membership unavailable", es: "Membresía no disponible", pt: "Associação indisponível", zh: "会员信息不可用" },
  "needs_you": { en: "Needs you", es: "Necesita tu intervención", pt: "Precisa de você", zh: "需要你处理" },
  "ignored": { en: "Ignored", es: "Ignoradas", pt: "Ignoradas", zh: "已忽略" },
  "open": { en: "Open", es: "Abrir", pt: "Abrir", zh: "打开" },
  "ignore": { en: "Ignore", es: "Ignorar", pt: "Ignorar", zh: "忽略" },
  "unignore": { en: "Unignore", es: "Dejar de ignorar", pt: "Deixar de ignorar", zh: "取消忽略" },
  "remove": { en: "Remove", es: "Eliminar", pt: "Remover", zh: "移除" },
  "copy_all": { en: "Copy all", es: "Copiar todo", pt: "Copiar tudo", zh: "全部复制" },
  "copy_code": { en: "Copy code", es: "Copiar código", pt: "Copiar código", zh: "复制代码" },
  "link_phone": { en: "Link a phone", es: "Vincular un celular", pt: "Vincular um celular", zh: "关联手机" },
  "unlink": { en: "Unlink", es: "Desvincular", pt: "Desvincular", zh: "取消关联" },
  "unlink_phone": { en: "Unlink this phone", es: "Desvincular este celular", pt: "Desvincular este celular", zh: "取消关联此手机" },
  "link_another_phone": { en: "Link another phone", es: "Vincular otro celular", pt: "Vincular outro celular", zh: "关联另一部手机" },
  "phone": { en: "Phone", es: "Celular", pt: "Celular", zh: "手机" },
  "this_device": { en: "This device", es: "Este dispositivo", pt: "Este dispositivo", zh: "此设备" },
  "install_bing": { en: "Install Bing", es: "Instalar Bing", pt: "Instalar Bing", zh: "安装 Bing" },
  "login_bing": { en: "Sign in to Bing", es: "Iniciar sesión en Bing", pt: "Entrar no Bing", zh: "登录 Bing" },
  "run_on_pc": { en: "Run on PC", es: "Ejecutar en PC", pt: "Executar no PC", zh: "在电脑上运行" },
  "start_on_pc": { en: "Start on PC", es: "Iniciar en PC", pt: "Iniciar no PC", zh: "在电脑上开始" },
  "tasks_only": { en: "Tasks only", es: "Solo tareas", pt: "Somente tarefas", zh: "仅任务" },
  "stop": { en: "Stop", es: "Detener", pt: "Parar", zh: "停止" },
  "checkin": { en: "Check-in", es: "Check-in", pt: "Check-in", zh: "签到" },
  "news": { en: "News", es: "Noticias", pt: "Notícias", zh: "新闻" },
  "all": { en: "All", es: "Todas", pt: "Todos", zh: "全部" },
  "success": { en: "Success", es: "Correcto", pt: "Sucesso", zh: "成功" },
  "errors": { en: "Errors", es: "Errores", pt: "Erros", zh: "错误" },
  "date": { en: "Date", es: "Fecha", pt: "Data", zh: "日期" },
  "time": { en: "Time", es: "Hora", pt: "Hora", zh: "时间" },
  "status": { en: "Status", es: "Estado", pt: "Status", zh: "状态" },
  "statistics": { en: "Statistics", es: "Estadísticas", pt: "Estatísticas", zh: "统计" },
  "execution_history": { en: "Execution History", es: "Historial de ejecuciones", pt: "Histórico de execuções", zh: "执行历史" },
  "refresh_balance": { en: "Refresh balance", es: "Actualizar saldo", pt: "Atualizar saldo", zh: "刷新余额" },
  "refreshing": { en: "Refreshing…", es: "Actualizando…", pt: "Atualizando…", zh: "正在刷新…" },
  "no_activity": { en: "No activity recorded today", es: "No hay actividad registrada hoy", pt: "Nenhuma atividade registrada hoje", zh: "今天没有记录的活动" },
  "no_activity_yet": { en: "No activity recorded yet. Start a run from the main window.", es: "Aún no hay actividad registrada. Inicia una ejecución desde la ventana principal.", pt: "Ainda não há atividade registrada. Inicie uma execução na janela principal.", zh: "尚无活动记录。请从主窗口开始运行。" },
  "language": { en: "Language", es: "Idioma", pt: "Idioma", zh: "语言" },
  "provider": { en: "Provider", es: "Proveedor", pt: "Provedor", zh: "提供商" },
  "model": { en: "Model", es: "Modelo", pt: "Modelo", zh: "模型" },
  "api_key": { en: "API key", es: "Clave API", pt: "Chave da API", zh: "API 密钥" },
  "default_provider": { en: "Default for provider", es: "Predeterminado del proveedor", pt: "Padrão do provedor", zh: "使用提供商默认值" },
  "your_api_key": { en: "Your own API key", es: "Tu propia clave API", pt: "Sua própria chave da API", zh: "你的 API 密钥" },
  "close_to_tray": { en: "Close to tray", es: "Cerrar a la bandeja", pt: "Fechar na bandeja", zh: "关闭到系统托盘" },
  "hide_browser": { en: "Hide browser", es: "Ocultar navegador", pt: "Ocultar navegador", zh: "隐藏浏览器" },
  "force_daily": { en: "Force daily tasks", es: "Forzar tareas diarias", pt: "Forçar tarefas diárias", zh: "强制每日任务" },
  "force_visual": { en: "Force visual search", es: "Forzar búsqueda visual", pt: "Forçar pesquisa visual", zh: "强制视觉搜索" },
  "run_running": { en: "Running…", es: "Ejecutando…", pt: "Executando…", zh: "正在运行…" },
  "run_stopping": { en: "Stopping…", es: "Deteniendo…", pt: "Parando…", zh: "正在停止…" },
  "status_running": { en: "Running", es: "En ejecución", pt: "Em execução", zh: "正在运行" },
  "status_ready": { en: "Ready", es: "Listo", pt: "Pronto", zh: "就绪" },
  "status_setup": { en: "Setup required", es: "Configuración requerida", pt: "Configuração necessária", zh: "需要设置" },
  "status_no_account": { en: "No account selected", es: "No hay cuenta seleccionada", pt: "Nenhuma conta selecionada", zh: "未选择账户" },
  "done": { en: "done", es: "completadas", pt: "concluídas", zh: "已完成" },
  "partial": { en: "partial", es: "parcial", pt: "parcial", zh: "部分完成" },
  "pending": { en: "pending", es: "pendiente", pt: "pendente", zh: "待处理" },
  "no_phone_offline": { en: "Phone offline", es: "Celular desconectado", pt: "Celular offline", zh: "手机离线" },
  "no_phone_linked": { en: "No phone linked", es: "No hay celular vinculado", pt: "Nenhum celular vinculado", zh: "未关联手机" },
  "activity_empty": { en: "Activity log is empty.", es: "El registro de actividad está vacío.", pt: "O registro de atividade está vazio.", zh: "活动记录为空。" },
  "activity_copied": { en: "Activity log copied.", es: "Registro de actividad copiado.", pt: "Registro de atividade copiado.", zh: "活动记录已复制。" },
  "settings_saved": { en: "Settings saved.", es: "Configuración guardada.", pt: "Configurações salvas.", zh: "设置已保存。" },
  "save_failed": { en: "Save failed.", es: "No se pudo guardar.", pt: "Não foi possível salvar.", zh: "保存失败。" },
  "settings_load_failed": { en: "Could not load settings.", es: "No se pudo cargar la configuración.", pt: "Não foi possível carregar as configurações.", zh: "无法加载设置。" },
  "account_switch_failed": { en: "Could not switch account. Is the bot running?", es: "No se pudo cambiar de cuenta. ¿El bot está ejecutándose?", pt: "Não foi possível trocar de conta. O bot está em execução?", zh: "无法切换账户。机器人正在运行吗？" },
  "account_create_failed": { en: "Could not create account.", es: "No se pudo crear la cuenta.", pt: "Não foi possível criar a conta.", zh: "无法创建账户。" },
  "account_create_running": { en: "Cannot add an account while the bot is running.", es: "No puedes agregar una cuenta mientras el bot está ejecutándose.", pt: "Não é possível adicionar uma conta enquanto o bot está em execução.", zh: "机器人运行时无法添加账户。" },
  "account_setup_cancelled": { en: "Setup cancelled — account not created.", es: "Configuración cancelada: la cuenta no fue creada.", pt: "Configuração cancelada — a conta não foi criada.", zh: "设置已取消，未创建账户。" },
  "hide_browser_on": { en: "Hide browser on. Saved.", es: "Ocultar navegador activado. Guardado.", pt: "Ocultar navegador ativado. Salvo.", zh: "已开启隐藏浏览器并保存。" },
  "hide_browser_off": { en: "Hide browser off. Saved.", es: "Ocultar navegador desactivado. Guardado.", pt: "Ocultar navegador desativado. Salvo.", zh: "已关闭隐藏浏览器并保存。" },
  "pc_range": { en: "PC must be between 0 and 130.", es: "PC debe estar entre 0 y 130.", pt: "PC deve estar entre 0 e 130.", zh: "电脑数量必须在 0 到 130 之间。" },
  "mobile_range": { en: "Mobile must be between 0 and 99.", es: "Móvil debe estar entre 0 y 99.", pt: "Celular deve estar entre 0 e 99.", zh: "手机数量必须在 0 到 99 之间。" },
  "choose_queries": { en: "Set at least one of PC or Mobile above 0.", es: "Configura PC o móvil por encima de 0.", pt: "Defina PC ou celular acima de 0.", zh: "请将电脑或手机中的至少一项设为大于 0。" },
  "phone_pc_found": { en: "PC found. Confirm the code and link.", es: "PC encontrado. Confirma el código y vincula.", pt: "PC encontrado. Confirme o código e vincule.", zh: "已找到电脑。请确认代码并关联。" },
  "phone_pairing": { en: "Linking…", es: "Vinculando…", pt: "Vinculando…", zh: "正在关联…" },
  "phone_searching": { en: "Looking for the PC…", es: "Buscando el PC…", pt: "Procurando o PC…", zh: "正在查找电脑…" },
  "camera_opening": { en: "Opening camera…", es: "Abriendo la cámara…", pt: "Abrindo a câmera…", zh: "正在打开相机…" },
  "camera_android_only": { en: "Camera is only available in the Android app.", es: "La cámara solo está en la app Android.", pt: "A câmera só está disponível no app Android.", zh: "相机仅在 Android 应用中可用。" },
  "background_run": { en: "Enable Background Auto-Run", es: "Activar ejecución automática en segundo plano", pt: "Ativar execução automática em segundo plano", zh: "启用后台自动运行" },
  "scheduled_runs": { en: "Scheduled runs", es: "Ejecuciones programadas", pt: "Execuções agendadas", zh: "计划运行" },
  "open_on_login": { en: "Open AutoRewarder when you sign in", es: "Abrir AutoRewarder al iniciar sesión", pt: "Abrir o AutoRewarder ao entrar", zh: "登录时打开 AutoRewarder" },
  "search_terms": { en: "Search terms", es: "Términos de búsqueda", pt: "Termos de pesquisa", zh: "搜索词" },
  "ai_terms": { en: "Generate search terms with AI (LLM)", es: "Generar términos de búsqueda con IA (LLM)", pt: "Gerar termos de pesquisa com IA (LLM)", zh: "使用 AI（LLM）生成搜索词" },
  "welcome": { en: "Welcome to AutoRewarder", es: "Bienvenido a AutoRewarder", pt: "Bem-vindo ao AutoRewarder", zh: "欢迎使用 AutoRewarder" },
  "person_icon_accounts": { en: "Use the person icon at the top to add or manage accounts.", es: "Usa el icono de persona de la parte superior para agregar o administrar cuentas.", pt: "Use o ícone de pessoa no topo para adicionar ou gerenciar contas.", zh: "使用顶部的人像图标添加或管理账户。" },
  "automatic_language": { en: "Automatic (Windows / region)", es: "Automático (Windows / región)", pt: "Automático (Windows / região)", zh: "自动（Windows / 地区）" },
  "language_hint": { en: "Automatic uses Windows / region. Applies to this PC and the linked phone.", es: "Automático usa Windows / región. Aplica a este PC y al celular vinculado.", pt: "Automático usa Windows / região. Aplica-se a este PC e ao celular vinculado.", zh: "自动模式使用 Windows / 地区设置，并应用于此电脑和关联手机。" },
  "close_to_tray_hint": { en: "Clicking X minimizes to the system tray instead of quitting. Takes effect on next launch.", es: "Al pulsar X se minimiza a la bandeja del sistema en vez de cerrar. Se aplica en el próximo inicio.", pt: "Clicar no X minimiza para a bandeja do sistema em vez de fechar. Vale na próxima abertura.", zh: "点击 X 会最小化到系统托盘而不是退出。下次启动时生效。" },
  "llm_key_hint": { en: "Your API key is stored locally in settings.json (plain text). Requests only send a prompt asking for queries — no personal data.", es: "Tu clave API se guarda localmente en settings.json (texto plano). Las solicitudes solo envían un mensaje para pedir búsquedas, sin datos personales.", pt: "Sua chave da API é armazenada localmente em settings.json (texto simples). As solicitações enviam apenas um pedido de pesquisas, sem dados pessoais.", zh: "你的 API 密钥仅以纯文本保存在本地 settings.json 中。请求只会发送生成搜索词的提示，不含个人数据。" },
  "manual_tasks_hint": { en: "Quests and leftover cards from your live /earn page that still need you (or that the bot could not finish). The list is detected and refreshed automatically in the background. Ignore hides until you unignore; Remove hides for good.", es: "Misiones y tarjetas pendientes de tu página /earn que aún necesitan tu intervención (o que el bot no pudo terminar). La lista se detecta y actualiza automáticamente en segundo plano. Ignorar las oculta hasta que dejes de ignorarlas; Eliminar las oculta definitivamente.", pt: "Missões e cartões pendentes da sua página /earn que ainda precisam de você (ou que o bot não conseguiu concluir). A lista é detectada e atualizada automaticamente em segundo plano. Ignorar oculta até você reativar; Remover oculta definitivamente.", zh: "这是你的 /earn 页面中仍需要你处理或机器人未能完成的任务和卡片。列表会在后台自动检测和刷新。忽略会隐藏直到你取消忽略；移除会永久隐藏。" },
  "all_accounts": { en: "All accounts", es: "Todas las cuentas", pt: "Todas as contas", zh: "所有账户" },
  "lifetime_activity": { en: "Lifetime activity", es: "Actividad total", pt: "Atividade total", zh: "累计活动" },
  "recent_activity": { en: "Recent activity (estimated points / day)", es: "Actividad reciente (puntos estimados / día)", pt: "Atividade recente (pontos estimados / dia)", zh: "近期活动（估计积分/天）" },
  "pc_searches": { en: "PC searches", es: "Búsquedas en PC", pt: "Pesquisas no PC", zh: "电脑搜索" },
  "mobile_searches": { en: "Mobile searches", es: "Búsquedas móviles", pt: "Pesquisas no celular", zh: "手机搜索" },
  "daily_cards": { en: "Daily cards", es: "Tarjetas diarias", pt: "Cartões diários", zh: "每日卡片" },
  "earn_cards": { en: "Earn cards", es: "Tarjetas de ganancias", pt: "Cartões de ganhos", zh: "赚取卡片" },
  "quest_tasks": { en: "Quest tasks", es: "Tareas de misiones", pt: "Tarefas de missões", zh: "任务挑战" },
  "visual_searches": { en: "Visual searches", es: "Búsquedas visuales", pt: "Pesquisas visuais", zh: "视觉搜索" },
  "edge_minutes": { en: "Edge minutes", es: "Minutos de Edge", pt: "Minutos do Edge", zh: "Edge 分钟数" },
  "runs": { en: "Runs", es: "Ejecuciones", pt: "Execuções", zh: "运行次数" },

  // Runtime-rendered copy. Keep these keys here instead of relying on the
  // reverse text lookup: values containing account names, counts or status
  // labels cannot be translated reliably after interpolation.
  "run.loading_short": { en: "Loading…", es: "Cargando…", pt: "Carregando…", zh: "正在加载…" },
  "run.stopping_short": { en: "Stopping…", es: "Deteniendo…", pt: "Parando…", zh: "正在停止…" },
  "run.ready_to_run": { en: "Ready to run", es: "Listo para ejecutar", pt: "Pronto para executar", zh: "可以运行" },
  "run.setup_pending": { en: "Setup pending", es: "Configuración pendiente", pt: "Configuração pendente", zh: "等待设置" },
  "status.pending": { en: "pending", es: "pendiente", pt: "pendente", zh: "待处理" },
  "status.done": { en: "done", es: "hecho", pt: "concluído", zh: "已完成" },
  "status.partial": { en: "partial", es: "parcial", pt: "parcial", zh: "部分完成" },
  "status.unknown": { en: "unknown", es: "desconocido", pt: "desconhecido", zh: "未知" },
  "status.resets_midnight": { en: "resets at midnight", es: "se reinicia a medianoche", pt: "reinicia à meia-noite", zh: "午夜重置" },
  "status.current": { en: "Current", es: "Actual", pt: "Atual", zh: "当前" },
  "account.ready": { en: "Ready", es: "Listo", pt: "Pronto", zh: "就绪" },
  "account.ready_to_run": { en: "Ready to run", es: "Listo para ejecutar", pt: "Pronto para executar", zh: "可以运行" },
  "account.setup_pending": { en: "Setup pending", es: "Configuración pendiente", pt: "Configuração pendente", zh: "等待设置" },
  "account.no_account": { en: "No account yet", es: "Aún no hay cuenta", pt: "Ainda não há conta", zh: "暂无账户" },
  "account.select_below": { en: "Select one below", es: "Selecciona una cuenta abajo", pt: "Selecione uma conta abaixo", zh: "请在下方选择账户" },
  "account.add_first": { en: "Add your first account", es: "Agrega tu primera cuenta", pt: "Adicione sua primeira conta", zh: "添加你的第一个账户" },
  "account.current": { en: "Current · ", es: "Actual · ", pt: "Atual · ", zh: "当前 · " },
  "account.rename": { en: "Rename", es: "Renombrar", pt: "Renomear", zh: "重命名" },
  "account.rerun_setup": { en: "Re-run setup", es: "Repetir configuración", pt: "Executar configuração novamente", zh: "重新设置" },
  "account.run_setup": { en: "Run setup", es: "Configurar", pt: "Executar configuração", zh: "运行设置" },
  "account.delete": { en: "Delete", es: "Eliminar", pt: "Excluir", zh: "删除" },
  "account.delete_question": { en: "Delete \"{name}\"?", es: "¿Eliminar \"{name}\"?", pt: "Excluir \"{name}\"?", zh: "删除“{name}”？" },
  "account.rename_prompt": { en: "Enter a new name for \"{name}\".", es: "Escribe un nombre nuevo para \"{name}\".", pt: "Digite um novo nome para \"{name}\".", zh: "请输入“{name}”的新名称。" },
  "account.opening_setup": { en: "Opening browser to set up \"{name}\"…", es: "Abriendo el navegador para configurar \"{name}\"…", pt: "Abrindo o navegador para configurar \"{name}\"…", zh: "正在打开浏览器设置“{name}”…" },
  "account.same_microsoft": { en: "Same Microsoft account · companion APK", es: "Misma cuenta Microsoft · APK complementaria", pt: "Mesma conta Microsoft · APK complementar", zh: "同一个 Microsoft 账户 · 配套 APK" },
  "phone.online": { en: "Online", es: "En línea", pt: "Online", zh: "在线" },
  "phone.offline": { en: "Offline", es: "Desconectado", pt: "Offline", zh: "离线" },
  "phone.link_another": { en: "Link another phone", es: "Vincular otro celular", pt: "Vincular outro celular", zh: "关联另一部手机" },
  "phone.ready": { en: "Ready to run", es: "Listo para ejecutar", pt: "Pronto para executar", zh: "可以运行" },
  "phone.setup_pending": { en: "Setup pending", es: "Configuración pendiente", pt: "Configuração pendente", zh: "等待设置" },
  "phone.linked": { en: "Linked to PC", es: "Vinculado al PC", pt: "Vinculado ao PC", zh: "已关联到电脑" },
  "phone.this_device": { en: "This device", es: "Este dispositivo", pt: "Este dispositivo", zh: "此设备" },
  "phone.same_account": { en: "Same Microsoft account", es: "Misma cuenta Microsoft", pt: "Mesma conta Microsoft", zh: "同一个 Microsoft 账户" },
  "phone.companion": { en: "Mobile companion", es: "Compañero móvil", pt: "Companheiro móvel", zh: "移动助手" },
  "phone.pc_running": { en: "PC is running", es: "El PC está ejecutándose", pt: "O PC está executando", zh: "电脑正在运行" },
  "phone.linked_ready": { en: "Linked to PC · ready", es: "Vinculado al PC · listo", pt: "Vinculado ao PC · pronto", zh: "已关联到电脑 · 就绪" },
  "phone.bing_not_installed": { en: "Bing: not installed", es: "Bing: no instalado", pt: "Bing: não instalado", zh: "Bing：未安装" },
  "phone.bing_ready": { en: "Bing: ready", es: "Bing: listo", pt: "Bing: pronto", zh: "Bing：就绪" },
  "phone.bing_installed": { en: "Bing: installed", es: "Bing: instalado", pt: "Bing: instalado", zh: "Bing：已安装" },
  "phone.searches_saved": { en: "Searches: PC {pc} / mobile {mobile}", es: "Búsquedas: PC {pc} / móvil {mobile}", pt: "Pesquisas: PC {pc} / celular {mobile}", zh: "搜索：电脑 {pc} / 手机 {mobile}" },
  "phone.pc_job": { en: "PC task: {kind}", es: "Tarea del PC: {kind}", pt: "Tarefa do PC: {kind}", zh: "电脑任务：{kind}" },
  "phone.bind_pc": { en: "Link to PC", es: "Vincular al PC", pt: "Vincular ao PC", zh: "关联到电脑" },
  "phone.pair_hint": { en: "On the PC: Account → Link a phone. Enter the code or tap the square to scan the QR.", es: "En el PC: Cuenta → Vincular un celular. Escribe el código o pulsa el cuadrado para escanear el QR.", pt: "No PC: Conta → Vincular um celular. Digite o código ou toque no quadrado para escanear o QR.", zh: "在电脑上：账户 → 关联手机。输入代码，或点击方框扫描二维码。" },
  "phone.pair": { en: "Link", es: "Vincular", pt: "Vincular", zh: "关联" },
  "phone.code": { en: "Code", es: "Código", pt: "Código", zh: "代码" },
  "phone.points": { en: "Points", es: "Puntos", pt: "Pontos", zh: "积分" },
  "phone.total": { en: "Total", es: "Total", pt: "Total", zh: "总计" },
  "phone.today": { en: "Today", es: "Hoy", pt: "Hoje", zh: "今天" },
  "phone.on_device": { en: "On this phone", es: "En este celular", pt: "Neste celular", zh: "在此手机上" },
  "phone.run_on_pc": { en: "Run on PC", es: "Correr en el PC", pt: "Executar no PC", zh: "在电脑上运行" },
  "phone.edge_30": { en: "Edge 30 min", es: "Edge 30 min", pt: "Edge 30 min", zh: "Edge 30 分钟" },
  "phone.activity": { en: "Activity", es: "Actividad", pt: "Atividade", zh: "活动" },
  "phone.unlink_this": { en: "Unlink this phone", es: "Desvincular este celular", pt: "Desvincular este celular", zh: "取消关联此手机" },
  "scan_qr": { en: "Scan QR", es: "Escanear QR", pt: "Escanear QR", zh: "扫描二维码" },
  "settings.detected_language": { en: "Detected language: {locale}. Leave \"auto\" to follow your system, or enter a locale like fr-FR.", es: "Idioma detectado: {locale}. Deja \"auto\" para seguir tu sistema o escribe una región como fr-FR.", pt: "Idioma detectado: {locale}. Deixe \"auto\" para seguir o sistema ou informe uma região como fr-FR.", zh: "检测到的语言：{locale}。保留“auto”以使用系统设置，或输入类似 fr-FR 的区域。" },
  "settings.windows_only": { en: "Available on Windows only.", es: "Disponible solo en Windows.", pt: "Disponível apenas no Windows.", zh: "仅适用于 Windows。" },
  "settings.windows_linux": { en: "Available on Windows and Linux only.", es: "Disponible solo en Windows y Linux.", pt: "Disponível apenas no Windows e Linux.", zh: "仅适用于 Windows 和 Linux。" },
  "settings.background_hint": { en: "Automatically run AutoRewarder in the background at each account's scheduled time.", es: "Ejecuta AutoRewarder automáticamente en segundo plano a la hora programada de cada cuenta.", pt: "Executa o AutoRewarder automaticamente em segundo plano no horário programado de cada conta.", zh: "在每个账户的计划时间于后台自动运行 AutoRewarder。" },
  "settings.login_hint": { en: "When you sign in to Windows, run leftover searches and daily tasks. If everything is already done, AutoRewarder closes.", es: "Al iniciar sesión en Windows, ejecuta las búsquedas y tareas diarias pendientes. Si todo está listo, AutoRewarder se cierra.", pt: "Ao entrar no Windows, executa pesquisas e tarefas diárias pendentes. Se tudo já estiver concluído, o AutoRewarder fecha.", zh: "登录 Windows 时运行剩余搜索和每日任务。如果全部完成，AutoRewarder 会关闭。" },
  "settings.preparing_driver": { en: "Preparing the browser driver…", es: "Preparando el controlador del navegador…", pt: "Preparando o driver do navegador…", zh: "正在准备浏览器驱动…" },
  "tasks.open": { en: "Open", es: "Abrir", pt: "Abrir", zh: "打开" },
  "tasks.ignore": { en: "Ignore", es: "Ignorar", pt: "Ignorar", zh: "忽略" },
  "tasks.unignore": { en: "Unignore", es: "Dejar de ignorar", pt: "Deixar de ignorar", zh: "取消忽略" },
  "tasks.remove": { en: "Remove", es: "Eliminar", pt: "Remover", zh: "移除" },
  "tasks.detecting": { en: "Detecting quests automatically from Rewards /earn…", es: "Detectando misiones automáticamente desde Rewards /earn…", pt: "Detectando missões automaticamente no Rewards /earn…", zh: "正在从 Rewards /earn 自动检测任务…" },
  "tasks.empty": { en: "No open quests detected yet. The list refreshes automatically.", es: "Aún no se detectaron misiones abiertas. La lista se actualiza automáticamente.", pt: "Nenhuma missão aberta detectada. A lista é atualizada automaticamente.", zh: "尚未检测到开放任务。列表会自动刷新。" },
  "left": { en: "left", es: "restantes", pt: "restantes", zh: "剩余" },
  "by_microsoft": { en: "by Microsoft", es: "por Microsoft", pt: "pela Microsoft", zh: "由 Microsoft 提供" },
  "hide_browser_on": { en: "Hide browser on. Saved.", es: "Navegador oculto. Guardado.", pt: "Navegador oculto. Salvo.", zh: "已隐藏浏览器。已保存。" },
  "hide_browser_off": { en: "Hide browser off. Saved.", es: "Navegador visible. Guardado.", pt: "Navegador visível. Salvo.", zh: "已显示浏览器。已保存。" },
  "schedule_off": { en: "Schedule off", es: "Horario apagado", pt: "Agendamento desativado", zh: "计划已关闭" },
};

Object.assign(UI_COPY, {
  "balance_not_verified": { en: "Balance not verified", es: "Saldo no verificado", pt: "Saldo não verificado", zh: "余额尚未验证" },
  "balance_not_found": { en: "Balance not found", es: "Saldo no encontrado", pt: "Saldo não encontrado", zh: "未找到余额" },
  "diagnostic": { en: "Diagnostic", es: "Diagnóstico", pt: "Diagnóstico", zh: "诊断" },
  "landed_page": { en: "Landed page:", es: "Página cargada:", pt: "Página carregada:", zh: "打开的页面：" },
  "selector_matches": { en: "Selector matches:", es: "Coincidencias del selector:", pt: "Correspondências do seletor:", zh: "选择器匹配：" },
  "real_balance": { en: "Real balance", es: "Saldo real", pt: "Saldo real", zh: "实际余额" },
  "balance_updated": { en: "Real balance · updated {when}", es: "Saldo real · actualizado {when}", pt: "Saldo real · atualizado {when}", zh: "实际余额 · 更新于 {when}" },
  "today": { en: "Today", es: "Hoy", pt: "Hoje", zh: "今天" },
  "no_activity_today": { en: "No activity recorded today", es: "No hay actividad registrada hoy", pt: "Nenhuma atividade registrada hoje", zh: "今天没有记录的活动" },
  "news_reads": { en: "News reads", es: "Noticias leídas", pt: "Notícias lidas", zh: "新闻阅读" },
  "daily": { en: "Daily", es: "Diario", pt: "Diário", zh: "每日" },
  "earn": { en: "Earn", es: "Ganancias", pt: "Ganhos", zh: "赚取" },
  "quests": { en: "Quests", es: "Misiones", pt: "Missões", zh: "任务" },
  "searches": { en: "Searches", es: "Búsquedas", pt: "Pesquisas", zh: "搜索" },
  "no_accounts_period": { en: "No accounts yet.", es: "Aún no hay cuentas.", pt: "Ainda não há contas.", zh: "还没有账户。" },
  "refresh_failed": { en: "Refresh failed.", es: "Falló la actualización.", pt: "Falha ao atualizar.", zh: "刷新失败。" },
  "refresh_error_no_account": { en: "No account selected.", es: "No hay cuenta seleccionada.", pt: "Nenhuma conta selecionada.", zh: "未选择账户。" },
  "refresh_error_setup": { en: "Complete First Setup for this account first.", es: "Completa primero la configuración inicial de esta cuenta.", pt: "Conclua primeiro a configuração inicial desta conta.", zh: "请先完成此账户的初始设置。" },
  "refresh_error_busy": { en: "Browser busy (a run or startup is using it) — try again in a moment.", es: "El navegador está ocupado (lo usa una ejecución o el inicio); inténtalo en un momento.", pt: "O navegador está ocupado (uma execução ou inicialização o está usando); tente novamente em instantes.", zh: "浏览器正忙（运行或启动正在使用它），请稍后重试。" },
  "refresh_error_not_found": { en: "Couldn't read the balance from the rewards page.", es: "No se pudo leer el saldo de la página de recompensas.", pt: "Não foi possível ler o saldo da página de recompensas.", zh: "无法从奖励页面读取余额。" },
  "refresh_error_driver": { en: "Could not open the browser to read the balance.", es: "No se pudo abrir el navegador para leer el saldo.", pt: "Não foi possível abrir o navegador para ler o saldo.", zh: "无法打开浏览器读取余额。" },
  "refresh_error_changed": { en: "Account changed during refresh — try again.", es: "La cuenta cambió durante la actualización; inténtalo de nuevo.", pt: "A conta mudou durante a atualização; tente novamente.", zh: "刷新期间账户发生变化，请重试。" },
  "no_points_match": { en: "(no .pointsValue elements matched)", es: "(no coincidió ningún elemento .pointsValue)", pt: "(nenhum elemento .pointsValue correspondeu)", zh: "（没有匹配 .pointsValue 元素）" },
  "unknown": { en: "(unknown)", es: "(desconocido)", pt: "(desconhecido)", zh: "（未知）" },
  "none": { en: "(none)", es: "(ninguno)", pt: "(nenhum)", zh: "（无）" },
  "title_statistics": { en: "Statistics", es: "Estadísticas", pt: "Estatísticas", zh: "统计" },
  "title_history": { en: "Execution History", es: "Historial de ejecuciones", pt: "Histórico de execuções", zh: "执行历史" },
  "filter_history": { en: "Filter history", es: "Filtrar historial", pt: "Filtrar histórico", zh: "筛选历史记录" },
  "no_runs_yet": { en: "No runs yet. Start one from the main window.", es: "Aún no hay ejecuciones. Inicia una desde la ventana principal.", pt: "Ainda não há execuções. Inicie uma pela janela principal.", zh: "还没有运行记录。请从主窗口开始运行。" },
  "no_errors_history": { en: "No errors in this history.", es: "No hay errores en este historial.", pt: "Não há erros neste histórico.", zh: "此历史记录中没有错误。" },
  "no_success_history": { en: "No successful entries in this history.", es: "No hay entradas exitosas en este historial.", pt: "Não há entradas bem-sucedidas neste histórico.", zh: "此历史记录中没有成功项目。" },
  "title": { en: "Title:", es: "Título:", pt: "Título:", zh: "标题：" },
  "dismiss": { en: "Dismiss", es: "Descartar", pt: "Dispensar", zh: "关闭" },
  "update_download_failed": { en: "Download failed: {error}", es: "Falló la descarga: {error}", pt: "Falha no download: {error}", zh: "下载失败：{error}" },
  "update_no_custom": { en: "No custom update is available.", es: "No hay una actualización propia disponible.", pt: "Não há atualização própria disponível.", zh: "没有可用的自定义更新。" },
  "update_github_failed": { en: "Could not check GitHub.", es: "No se pudo consultar GitHub.", pt: "Não foi possível consultar o GitHub.", zh: "无法检查 GitHub。" },
  "schedule_enable": { en: "Enable schedule", es: "Activar horario", pt: "Ativar agendamento", zh: "启用计划" },
  "schedule_enable_for": { en: "Enable schedule for {name}", es: "Activar horario para {name}", pt: "Ativar agendamento para {name}", zh: "为 {name} 启用计划" },
  "schedule_dashboard": { en: "Rewards dashboard", es: "Panel de recompensas", pt: "Painel de recompensas", zh: "奖励面板" },
  "dashboard_auto": { en: "Auto (detect)", es: "Automático (detectar)", pt: "Automático (detectar)", zh: "自动（检测）" },
  "dashboard_legacy": { en: "Legacy", es: "Anterior", pt: "Legado", zh: "旧版" },
  "dashboard_new": { en: "New", es: "Nuevo", pt: "Novo", zh: "新版" },
  "advanced_scheduling": { en: "Advanced scheduling (drip-feed across duration)", es: "Programación avanzada (distribuir durante la duración)", pt: "Agendamento avançado (distribuir durante a duração)", zh: "高级计划（在整个时长内分批运行）" },
  "daily_run_time": { en: "Daily run time", es: "Hora de ejecución diaria", pt: "Horário da execução diária", zh: "每日运行时间" },
  "run_duration": { en: "Run duration (h)", es: "Duración (h)", pt: "Duração (h)", zh: "运行时长（小时）" },
  "queries_hour": { en: "Queries / hour", es: "Búsquedas / hora", pt: "Pesquisas / hora", zh: "搜索次数/小时" },
  "copy_all": { en: "Copy all", es: "Copiar todo", pt: "Copiar tudo", zh: "全部复制" },
  "phone_offline_toast": { en: "Phone offline", es: "Celular desconectado", pt: "Celular offline", zh: "手机离线" },
  "phone_unlink_failed": { en: "Could not unlink the phone.", es: "No se pudo desvincular el celular.", pt: "Não foi possível desvincular o celular.", zh: "无法取消关联手机。" },
  "phone_already_unlinked": { en: "Phone was already unlinked or could not be removed.", es: "El celular ya estaba desvinculado o no se pudo eliminar.", pt: "O celular já estava desvinculado ou não pôde ser removido.", zh: "手机已取消关联或无法移除。" },
  "pair_failed": { en: "Could not start pairing.", es: "No se pudo iniciar la vinculación.", pt: "Não foi possível iniciar a vinculação.", zh: "无法开始关联。" },
  "phone_online_close": { en: "Phone online. If it already joined, you can close this.", es: "Celular en línea. Si ya entró, puedes cerrar esto.", pt: "Celular online. Se já entrou, você pode fechar.", zh: "手机已上线。如果已经加入，可以关闭此窗口。" },
  "phone.by_phone": { en: "by phone", es: "por celular", pt: "pelo celular", zh: "由手机" },
  "status.ok": { en: "OK", es: "OK", pt: "OK", zh: "成功" },
  "status.skipped": { en: "Skipped", es: "Omitido", pt: "Ignorado", zh: "已跳过" },
  "status.error_prefix": { en: "[ERROR]", es: "[ERROR]", pt: "[ERRO]", zh: "[错误]" },
  "status.warning_prefix": { en: "[WARNING]", es: "[ADVERTENCIA]", pt: "[AVISO]", zh: "[警告]" },
  "account_switch_error": { en: "Could not switch account. Is the bot running?", es: "No se pudo cambiar de cuenta. ¿El bot está ejecutándose?", pt: "Não foi possível trocar de conta. O bot está em execução?", zh: "无法切换账户。机器人正在运行吗？" },
  "account_delete_error": { en: "Could not delete the account. Stop the run and try again.", es: "No se pudo borrar la cuenta. Detén la ejecución e inténtalo de nuevo.", pt: "Não foi possível excluir a conta. Pare a execução e tente novamente.", zh: "无法删除账户。请停止运行后重试。" },
  "account_deleted": { en: "Account \"{name}\" was deleted.", es: "La cuenta \"{name}\" fue eliminada.", pt: "A conta \"{name}\" foi excluída.", zh: "账户“{name}”已删除。" },
  "add_account_title": { en: "Add a new account", es: "Agregar una cuenta nueva", pt: "Adicionar uma nova conta", zh: "添加新账户" },
  "add_account_hint": { en: "Give this account a name — you can rename it later.", es: "Dale un nombre a esta cuenta; podrás cambiarlo después.", pt: "Dê um nome para esta conta — você poderá alterá-lo depois.", zh: "为此账户命名，之后可以重命名。" },
  "continue": { en: "Continue", es: "Continuar", pt: "Continuar", zh: "继续" },
  "account_open_login": { en: "Opening the browser for \"{name}\". Sign in, then close the window.", es: "Abriendo el navegador para \"{name}\". Inicia sesión y cierra la ventana.", pt: "Abrindo o navegador para \"{name}\". Entre e feche a janela.", zh: "正在为“{name}”打开浏览器。登录后关闭窗口。" },
  "account_bot_running": { en: "Cannot add an account while the bot is running.", es: "No puedes agregar una cuenta mientras el bot está ejecutándose.", pt: "Não é possível adicionar uma conta enquanto o bot está em execução.", zh: "机器人运行时无法添加账户。" },
  "account_setup_failed": { en: "Setup cancelled — account not created.", es: "Configuración cancelada: la cuenta no fue creada.", pt: "Configuração cancelada — a conta não foi criada.", zh: "设置已取消，未创建账户。" },
  "account_created": { en: "Account \"{name}\" is ready.", es: "La cuenta \"{name}\" está lista.", pt: "A conta \"{name}\" está pronta.", zh: "账户“{name}”已准备就绪。" },
  "settings_load_error": { en: "Could not load settings.", es: "No se pudo cargar la configuración.", pt: "Não foi possível carregar as configurações.", zh: "无法加载设置。" },
  "schedule_pc_range": { en: "PC queries must be between 0 and 130.", es: "Las búsquedas de PC deben estar entre 0 y 130.", pt: "As pesquisas no PC devem estar entre 0 e 130.", zh: "电脑搜索次数必须在 0 到 130 之间。" },
  "schedule_mobile_range": { en: "Mobile queries must be between 0 and 99.", es: "Las búsquedas móviles deben estar entre 0 y 99.", pt: "As pesquisas móveis devem estar entre 0 e 99.", zh: "手机搜索次数必须在 0 到 99 之间。" },
  "schedule_choose_queries": { en: "Set at least one of PC or Mobile queries above 0.", es: "Configura búsquedas de PC o móvil por encima de 0.", pt: "Defina pesquisas no PC ou celular acima de 0.", zh: "请将电脑或手机搜索次数至少设置为 1。" },
  "schedule_time_invalid": { en: "Daily run time must be a valid HH:MM value.", es: "La hora diaria debe tener un formato HH:MM válido.", pt: "O horário diário deve ter um valor HH:MM válido.", zh: "每日运行时间必须是有效的 HH:MM。" },
  "schedule_duration_range": { en: "Run duration must be between 1 and 24 hours.", es: "La duración debe estar entre 1 y 24 horas.", pt: "A duração deve estar entre 1 e 24 horas.", zh: "运行时长必须在 1 到 24 小时之间。" },
  "schedule_qph_range": { en: "Queries per hour must be between 1 and 99.", es: "Las búsquedas por hora deben estar entre 1 y 99.", pt: "As pesquisas por hora devem estar entre 1 e 99.", zh: "每小时搜索次数必须在 1 到 99 之间。" },
  "schedules_saved": { en: "Schedules saved.", es: "Horarios guardados.", pt: "Agendamentos salvos.", zh: "计划已保存。" },
  "schedules_failed": { en: "{count} schedule(s) failed to save.", es: "No se pudieron guardar {count} horario(s).", pt: "Falha ao salvar {count} agendamento(s).", zh: "{count} 个计划保存失败。" },
  "settings_saved_startup_failed": { en: "Schedules saved, but a startup setting failed.", es: "Horarios guardados, pero falló una configuración de inicio.", pt: "Agendamentos salvos, mas uma configuração de inicialização falhou.", zh: "计划已保存，但启动设置失败。" },
  "activity_log_empty": { en: "Activity log is empty.", es: "El registro de actividad está vacío.", pt: "O registro de atividade está vazio.", zh: "活动记录为空。" },
  "activity_log_copied": { en: "Activity log copied.", es: "Registro de actividad copiado.", pt: "Registro de atividade copiado.", zh: "活动记录已复制。" },
  "activity_copy_failed": { en: "Could not copy the activity log.", es: "No se pudo copiar el registro de actividad.", pt: "Não foi possível copiar o registro de atividade.", zh: "无法复制活动记录。" },
  "checkin_sent": { en: "Check-in sent to the phone.", es: "Check-in enviado al celular.", pt: "Check-in enviado para o celular.", zh: "签到请求已发送到手机。" },
  "news_sent": { en: "Read-to-earn sent to the phone.", es: "Lectura para ganar enviada al celular.", pt: "Leitura para ganhar enviada para o celular.", zh: "阅读赚取请求已发送到手机。" },
  "phone_unlinked": { en: "Phone unlinked. Microsoft account kept.", es: "Celular desvinculado. La cuenta Microsoft se conservó.", pt: "Celular desvinculado. A conta Microsoft foi mantida.", zh: "手机已取消关联，Microsoft 账户保留。" },
});

Object.assign(UI_COPY, {
  "runtime.ok_prefix": { en: "OK", es: "Correcto", pt: "OK", zh: "成功" },
  "runtime.skipped_prefix": { en: "Skipped", es: "Omitido", pt: "Ignorado", zh: "已跳过" },
  "runtime.error_prefix": { en: "Error", es: "Error", pt: "Erro", zh: "错误" },
  "runtime.warning_prefix": { en: "Warning", es: "Advertencia", pt: "Aviso", zh: "警告" },
  "runtime.opening_edge": { en: "Opening Edge", es: "Abriendo Edge", pt: "Abrindo o Edge", zh: "正在打开 Edge" },
  "runtime.edge_ready": { en: "Edge is ready.", es: "Edge está listo.", pt: "O Edge está pronto.", zh: "Edge 已准备就绪。" },
  "runtime.already_complete": { en: "already complete today, skipping.", es: "ya está completo hoy; se omitirá.", pt: "já está concluído hoje; será ignorado.", zh: "今天已完成，跳过。" },
  "runtime.not_listed": { en: "not listed on today's dashboard, skipping.", es: "no aparece en el panel de hoy; se omitirá.", pt: "não aparece no painel de hoje; será ignorado.", zh: "未列在今天的面板中，跳过。" },
  "runtime.not_complete_running": { en: "not complete, running.", es: "no está completo; se ejecutará.", pt: "não está concluído; será executado.", zh: "尚未完成，正在运行。" },
  "runtime.credited": { en: "credited", es: "acreditado", pt: "creditado", zh: "已获得积分" },
  "runtime.already_done": { en: "already done", es: "ya completado", pt: "já concluído", zh: "已完成" },
  "runtime.no_phone": { en: "No linked phone available for check-in/news; continuing with the simulated mobile client.", es: "No hay celular vinculado para el registro/noticias; se continuará con el cliente móvil simulado.", pt: "Não há celular vinculado para check-in/notícias; continuando com o cliente móvel simulado.", zh: "没有已关联的手机可用于签到/新闻，将继续使用模拟移动客户端。" },
  "runtime.nothing_to_do": { en: "Nothing to do (PC and Mobile counts are both 0).", es: "No hay nada que hacer (las cantidades de PC y móvil son 0).", pt: "Nada para fazer (as quantidades de PC e celular são 0).", zh: "没有要执行的任务（电脑和手机搜索次数均为 0）。" },
  "update_download_failed": { en: "Could not download the update: {error}", es: "No se pudo descargar la actualización: {error}", pt: "Não foi possível baixar a atualização: {error}", zh: "无法下载更新：{error}" },
  "update_original_newer": { en: "A new version of the upstream repository ({tag}) is available. Notify the developer; it will not be installed automatically.", es: "Hay una nueva versión del repositorio original ({tag}). Notifica al desarrollador; no se instalará automáticamente.", pt: "Há uma nova versão do repositório original ({tag}). Notifique o desenvolvedor; não será instalada automaticamente.", zh: "原始仓库有新版本（{tag}）。请通知开发者；不会自动安装。" },
  "update_original_also": { en: "There is also an upstream repository update to notify the developer about.", es: "También hay una actualización del repositorio original para notificar al desarrollador.", pt: "Há também uma atualização do repositório original para notificar o desenvolvedor.", zh: "还有原始仓库更新需通知开发者。" },
  "update_custom_available": { en: "New AutoRewarder update {tag} available. Download now?", es: "Nueva actualización propia {tag}. ¿Quieres descargarla?", pt: "Nova atualização {tag} disponível. Deseja baixar?", zh: "发现新版本 {tag}，是否立即下载？" },
  "accounts.empty_modal": { en: "No accounts yet. Click “Add account” to create your first one.", es: "Aún no hay cuentas. Haz clic en «Agregar cuenta» para crear la primera.", pt: "Ainda não há contas. Clique em “Adicionar conta” para criar a primeira.", zh: "暂无账户。点击“添加账户”创建第一个账户。" },
  "account.rename_title": { en: "Rename account", es: "Renombrar cuenta", pt: "Renomear conta", zh: "重命名账户" },
  "account.delete_msg": { en: "This removes its browser profile, history, and daily-set status. This cannot be undone.", es: "Esto eliminará su perfil del navegador, historial y estado de tareas diarias. No se puede deshacer.", pt: "Isso remove o perfil do navegador, histórico e status das tarefas diárias. Não pode ser desfeito.", zh: "这将删除其浏览器配置文件、历史记录和每日任务状态。此操作无法撤销。" },
  "account_renamed": { en: "Renamed to \"{name}\".", es: "Renombrada a \"{name}\".", pt: "Renomeada para \"{name}\".", zh: "已重命名为“{name}”。" },
  "account_rename_failed": { en: "Rename failed.", es: "No se pudo renombrar.", pt: "Falha ao renomear.", zh: "重命名失败。" },
  "account_setup_failed_start": { en: "Setup could not be started.", es: "No se pudo iniciar la configuración.", pt: "Não foi possível iniciar a configuração.", zh: "无法启动设置。" },
  "account_deleted_named": { en: "\"{name}\" deleted.", es: "\"{name}\" eliminada.", pt: "\"{name}\" excluída.", zh: "已删除“{name}”。" },
  "account_delete_failed": { en: "Delete failed.", es: "No se pudo eliminar.", pt: "Falha ao excluir.", zh: "删除失败。" },
  "phone.updates": { en: "Check updates", es: "Buscar actualizaciones", pt: "Verificar atualizações", zh: "检查更新" },
  "phone.download": { en: "Download", es: "Descargar", pt: "Baixar", zh: "下载" },
  "phone.cancel": { en: "Cancel", es: "Cancelar", pt: "Cancelar", zh: "取消" },
  "phone.pair": { en: "Link with PC", es: "Vincular con el PC", pt: "Vincular ao PC", zh: "与电脑关联" },
  "phone.pair_hint": { en: "In the PC app, open the Microsoft account and tap Link phone. Scan the QR or enter the code.", es: "En la app del PC, abre la cuenta Microsoft y pulsa Vincular celular. Escanea el QR o escribe el código.", pt: "No app do PC, abra a conta Microsoft e toque em Vincular celular. Escaneie o QR ou digite o código.", zh: "在电脑应用中打开 Microsoft 账户并点击关联手机。扫描二维码或输入代码。" },
  "phone.pair_btn": { en: "Link", es: "Vincular", pt: "Vincular", zh: "关联" },
  "phone.looking": { en: "Finding your PC…", es: "Buscando tu PC…", pt: "Procurando seu PC…", zh: "正在查找你的电脑…" },
  "phone.account": { en: "Microsoft account", es: "Cuenta Microsoft", pt: "Conta Microsoft", zh: "Microsoft 账户" },
  "phone.points": { en: "Points", es: "Puntos", pt: "Pontos", zh: "积分" },
  "phone.total": { en: "Total points", es: "Puntos totales", pt: "Total de pontos", zh: "总积分" },
  "phone.today": { en: "Earned today", es: "Ganados hoy", pt: "Ganhos hoje", zh: "今日获得" },
  "phone.brand": { en: "AutoRewarder", es: "AutoRewarder", pt: "AutoRewarder", zh: "AutoRewarder" },
  "phone.ready_state": { en: "Ready to run", es: "Listo para ejecutar", pt: "Pronto para executar", zh: "准备就绪" },
  "phone.setup_state": { en: "Setup pending", es: "Configuración pendiente", pt: "Configuração pendente", zh: "待设置" },
  "phone.by_microsoft": { en: "by Microsoft", es: "por Microsoft", pt: "pela Microsoft", zh: "由 Microsoft 提供" },
  "phone.by_phone": { en: "on this phone", es: "en este celular", pt: "neste celular", zh: "在此手机上" },
  "phone.rewards": { en: "Rewards overview", es: "Resumen de Rewards", pt: "Resumo do Rewards", zh: "Rewards 概览" },
  "phone.progress.pc": { en: "PC", es: "PC", pt: "PC", zh: "电脑" },
  "phone.progress.mobile": { en: "Mobile", es: "Móvil", pt: "Celular", zh: "手机" },
  "phone.progress.daily": { en: "Daily", es: "Diarias", pt: "Diárias", zh: "每日" },
  "phone.progress.visual": { en: "Visual", es: "Visual", pt: "Visual", zh: "视觉" },
  "phone.progress.checkin": { en: "Check-in", es: "Check-in", pt: "Check-in", zh: "签到" },
  "phone.progress.news": { en: "News", es: "Noticias", pt: "Notícias", zh: "新闻" },
  "phone.progress.edge": { en: "Edge", es: "Edge", pt: "Edge", zh: "Edge" },
  "phone.progress.reset": { en: "Daily set", es: "Tareas del día", pt: "Conjunto diário", zh: "每日任务集" },
  "phone.here": { en: "Bing on this phone", es: "Bing en este celular", pt: "Bing neste celular", zh: "此手机上的 Bing" },
  "phone.hint": { en: "Requires the same Microsoft account signed into Bing on this phone.", es: "Requiere tener la misma cuenta Microsoft iniciada en Bing en este celular.", pt: "Requer a mesma conta Microsoft conectada ao Bing neste celular.", zh: "需要在此手机的 Bing 中登录相同的 Microsoft 账户。" },
  "phone.checkin": { en: "Check-in", es: "Check-in", pt: "Check-in", zh: "签到" },
  "phone.news": { en: "Read news", es: "Leer noticias", pt: "Ler notícias", zh: "阅读新闻" },
  "phone.install": { en: "Install Bing", es: "Instalar Bing", pt: "Instalar o Bing", zh: "安装 Bing" },
  "phone.login": { en: "Sign in to Bing", es: "Iniciar sesión en Bing", pt: "Entrar no Bing", zh: "登录 Bing" },
  "phone.ready": { en: "Ready", es: "Listo", pt: "Pronto", zh: "就绪" },
  "phone.verify": { en: "Check again", es: "Volver a comprobar", pt: "Verificar novamente", zh: "重新检查" },
  "phone.runpc": { en: "Run on PC", es: "Ejecutar en el PC", pt: "Executar no PC", zh: "在电脑上运行" },
  "phone.start": { en: "Start run", es: "Iniciar en PC", pt: "Iniciar no PC", zh: "开始运行" },
  "phone.tasks": { en: "Tasks only", es: "Solo tareas", pt: "Somente tarefas", zh: "仅任务" },
  "phone.edge": { en: "Edge 30 min", es: "Edge 30 min", pt: "Edge 30 min", zh: "Edge 30 分钟" },
  "phone.stop": { en: "Stop", es: "Parar", pt: "Parar", zh: "停止" },
  "phone.activity": { en: "Activity", es: "Actividad", pt: "Atividade", zh: "活动" },
  "phone.unlink": { en: "Unlink phone", es: "Desvincular celular", pt: "Desvincular celular", zh: "取消关联手机" },
  "phone.linked": { en: "Linked to PC", es: "Vinculado al PC", pt: "Vinculado ao PC", zh: "已关联到电脑" },
  "phone.qr": { en: "Scan QR", es: "Escanear QR", pt: "Escanear QR", zh: "扫描二维码" },
  "phone.pc_running": { en: "PC is running", es: "El PC está ejecutándose", pt: "O PC está executando", zh: "电脑正在运行" },
  "phone.linked_ready": { en: "Linked to PC · ready", es: "Vinculado al PC · listo", pt: "Vinculado ao PC · pronto", zh: "已关联到电脑 · 就绪" },
  "phone.searches_saved": { en: "Searches: PC {pc} / mobile {mobile}", es: "Búsquedas: PC {pc} / móvil {mobile}", pt: "Pesquisas: PC {pc} / celular {mobile}", zh: "搜索：电脑 {pc} / 手机 {mobile}" },
  "phone.pc_job": { en: "PC task: {kind}", es: "Tarea del PC: {kind}", pt: "Tarefa do PC: {kind}", zh: "电脑任务：{kind}" },
  "bing.ok": { en: "Bing ready on this phone. Same Microsoft account as the PC.", es: "Bing listo en este celular. Misma cuenta Microsoft que en el PC.", pt: "Bing pronto neste celular. Mesma conta Microsoft do PC.", zh: "此手机上的 Bing 已就绪。与电脑使用相同的 Microsoft 账户。" },
  "bing.not_installed": { en: "Microsoft Bing is not installed on this phone. Install it and sign in with the same Microsoft account.", es: "Microsoft Bing no está instalado en este celular. Instálalo e inicia sesión con la misma cuenta Microsoft.", pt: "O Microsoft Bing não está instalado neste celular. Instale-o e entre com a mesma conta Microsoft.", zh: "此手机未安装 Microsoft Bing。请安装并使用相同的 Microsoft 账户登录。" },
  "bing.login_needed": { en: "Sign in to Bing on this phone with the same Microsoft account as the PC.", es: "Inicia sesión en Bing en este celular con la misma cuenta Microsoft del PC.", pt: "Entre no Bing neste celular com a mesma conta Microsoft do PC.", zh: "请在此手机的 Bing 中使用与电脑相同的 Microsoft 账户登录。" },
  "bing.login_prompt": { en: "Sign in to Microsoft below, then tap Ready.", es: "Inicia sesión en Microsoft abajo y pulsa Listo.", pt: "Entre na Microsoft abaixo e toque em Pronto.", zh: "请在下方登录 Microsoft，然后点击就绪。" },
  "bing.checking": { en: "Checking Microsoft session…", es: "Comprobando sesión Microsoft…", pt: "Verificando sessão da Microsoft…", zh: "正在检查 Microsoft 会话…" },
  "bing.session_ready": { en: "Microsoft session ready on this phone.", es: "Sesión Microsoft lista en este celular.", pt: "Sessão da Microsoft pronta neste celular.", zh: "此手机上的 Microsoft 会话已就绪。" },
  "bing.session_missing": { en: "No active Microsoft session detected yet. Complete sign-in and try again.", es: "Aún no se detecta la sesión Microsoft. Completa el login y vuelve a pulsar Listo.", pt: "Nenhuma sessão ativa da Microsoft detectada ainda. Conclua o login e tente novamente.", zh: "尚未检测到活动的 Microsoft 会话。请完成登录并重试。" },
  "updates.phone_available": { en: "New mobile version ({tag}). Download APK?", es: "Nueva versión móvil ({tag}). ¿Descargar APK?", pt: "Nova versão móvel ({tag}). Baixar APK?", zh: "发现新手机版本（{tag}）。是否下载 APK？" },
  "updates.phone_none": { en: "You already have the latest mobile version ({version}).", es: "Ya tienes la última versión móvil ({version}).", pt: "Você já tem a versão móvel mais recente ({version}).", zh: "你已安装最新手机版本（{version}）。" },
  "updates.phone_error": { en: "Could not check GitHub updates.", es: "No se pudo consultar GitHub.", pt: "Não foi possível verificar atualizações no GitHub.", zh: "无法检查 GitHub 更新。" },
  "gold_member": { en: "Gold Member", es: "Miembro Oro", pt: "Membro Ouro", zh: "黄金会员" },
  "silver_member": { en: "Silver Member", es: "Miembro Plata", pt: "Membro Prata", zh: "白银会员" },
  "bronze_member": { en: "Bronze Member", es: "Miembro Bronce", pt: "Membro Bronze", zh: "青铜会员" },
  "pts_per_day": { en: "pts/day", es: "pts/día", pt: "pts/dia", zh: "积分/天" },
  "recent_activity_verified": { en: "Recent activity (verified points / day)", es: "Actividad reciente (puntos verificados / día)", pt: "Atividade recente (pontos verificados / dia)", zh: "近期活动（每日已验证积分）" },
  "stats.reset_btn": { en: "Reset chart / stats", es: "Reiniciar gráfico / stats", pt: "Redefinir gráfico / stats", zh: "重置图表 / 统计" },
  "stats.reset_title": { en: "Reset statistics", es: "Reiniciar estadísticas", pt: "Redefinir estatísticas", zh: "重置统计数据" },
  "stats.reset_desc": { en: "Choose which statistics or chart data you want to reset for this account:", es: "Elige qué estadísticas o datos del gráfico quieres reiniciar en esta cuenta:", pt: "Escolha quais estatísticas ou dados do gráfico deseja redefinir nesta conta:", zh: "选择要为此账户重置的统计或图表数据：" },
  "stats.reset_scope_chart": { en: "Reset chart history (keep real balance)", es: "Reiniciar historial del gráfico (conservar saldo real)", pt: "Redefinir histórico do gráfico (manter saldo real)", zh: "重置图表历史记录（保留真实积分余额）" },
  "stats.reset_scope_today": { en: "Reset today's earned points to 0", es: "Reiniciar los puntos ganados hoy a 0", pt: "Redefinir pontos ganhos hoje para 0", zh: "将今日获得的积分重置为 0" },
  "stats.reset_scope_lifetime": { en: "Reset lifetime activity counters", es: "Reiniciar contadores históricos de actividad", pt: "Redefinir contadores de atividade histórica", zh: "重置累计活动计数器" },
  "stats.reset_scope_all": { en: "Reset all statistics & chart", es: "Reiniciar todas las estadísticas y el gráfico", pt: "Redefinir todas as estatísticas e o gráfico", zh: "重置所有统计数据和图表" },
  "stats.reset_confirm": { en: "Reset now", es: "Reiniciar ahora", pt: "Redefinir agora", zh: "立即重置" },
  "phone.run_all": { en: "Auto-run all", es: "Auto-ejecutar todo", pt: "Auto-executar tudo", zh: "自动运行全部" },
  "phone.claim": { en: "Claim points", es: "Reclamar puntos", pt: "Resgatar pontos", zh: "领取积分" },
  "claim": { en: "Claim", es: "Reclamar", pt: "Resgatar", zh: "领取" },
  "claim_sent": { en: "Claim task sent to phone.", es: "Tarea de reclamar enviada al celular.", pt: "Tarefa de resgate enviada ao celular.", zh: "领取积分任务已发送到手机。" },
  "phone_all_sent": { en: "All mobile tasks sent to phone.", es: "Todas las tareas móviles enviadas al celular.", pt: "Todas as tarefas móveis enviadas ao celular.", zh: "所有移动任务已发送到手机。" },
  "runtime.browser_hidden_on": { en: "Browser hidden mode: ON", es: "Modo navegador oculto: ACTIVADO", pt: "Modo navegador oculto: ATIVADO", zh: "隐藏浏览器模式：已开启" },
  "runtime.browser_hidden_off": { en: "Browser hidden mode: OFF", es: "Modo navegador oculto: DESACTIVADO", pt: "Modo navegador oculto: DESATIVADO", zh: "隐藏浏览器模式：已关闭" },
  "runtime.quest_detect_failed": { en: "Automatic quest detection failed", es: "Falló la detección automática de misiones", pt: "Falha na detecção automática de missões", zh: "自动检测任务失败" },
  "runtime.webdriver_error": { en: "Error loading WebDriver", es: "Error al cargar WebDriver", pt: "Erro ao carregar o WebDriver", zh: "加载 WebDriver 出错" },
  "runtime.refreshing_balance": { en: "Refreshing points balance…", es: "Actualizando saldo de puntos…", pt: "Atualizando saldo de pontos…", zh: "正在刷新积分余额…" },
  "runtime.balance_updated": { en: "Points balance updated", es: "Saldo de puntos actualizado", pt: "Saldo de pontos atualizado", zh: "积分余额已更新" },
  "runtime.switched_account": { en: "Switched to account", es: "Cambiado a la cuenta", pt: "Alternado para a conta", zh: "已切换到账户" },
  "runtime.stats_reset": { en: "Statistics reset", es: "Estadísticas reiniciadas", pt: "Estatísticas redefinidas", zh: "统计数据已重置" },
  "country.colombia": { en: "Colombia", es: "Colombia", pt: "Colômbia", zh: "哥伦比亚" },
  "country.us": { en: "United States", es: "Estados Unidos", pt: "Estados Unidos", zh: "美国" },
  "country.mexico": { en: "Mexico", es: "México", pt: "México", zh: "墨西哥" },
  "country.spain": { en: "Spain", es: "España", pt: "Espanha", zh: "西班牙" },
  "country.brazil": { en: "Brazil", es: "Brasil", pt: "Brasil", zh: "巴西" },
  "country.argentina": { en: "Argentina", es: "Argentina", pt: "Argentina", zh: "阿根廷" },
  "country.chile": { en: "Chile", es: "Chile", pt: "Chile", zh: "智利" },
  "country.peru": { en: "Peru", es: "Perú", pt: "Peru", zh: "秘鲁" },
  "country.uk": { en: "United Kingdom", es: "Reino Unido", pt: "Reino Unido", zh: "英国" },
  "country.canada": { en: "Canada", es: "Canadá", pt: "Canadá", zh: "加拿大" },
});

Object.keys(UI_COPY).forEach(function (key) {
  ["en", "es", "pt", "zh"].forEach(function (locale) {
    I18N[locale][key] = UI_COPY[key][locale];
  });
});

const _copyIndex = Object.create(null);
function _normKeyText(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}
Object.keys(UI_COPY).forEach(function (key) {
  Object.keys(UI_COPY[key]).forEach(function (locale) {
    const value = _normKeyText(UI_COPY[key][locale]);
    if (value && !_copyIndex[value]) {
      _copyIndex[value] = key;
    }
  });
});
Object.keys(I18N.en).forEach(function (key) {
  ["en", "es", "pt", "zh"].forEach(function (locale) {
    const value = _normKeyText(I18N[locale] && I18N[locale][key]);
    if (value && !_copyIndex[value]) {
      _copyIndex[value] = key;
    }
  });
});

// Keep the first-generation data-i18n attributes working while all new text
// uses the shared UI_COPY table above.
const LEGACY_COPY_KEYS = {
  "stats.total": "total_points",
  "stats.today": "earned_today",
  "stats.dashboard": "dashboard",
  "rewards": "rewards_overview",
  "activity": "activity",
  "history": "history",
  "queries": "queries",
};
Object.keys(LEGACY_COPY_KEYS).forEach(function (legacyKey) {
  const copyKey = LEGACY_COPY_KEYS[legacyKey];
  ["en", "es", "pt", "zh"].forEach(function (locale) {
    I18N[locale][legacyKey] = UI_COPY[copyKey][locale];
  });
});

function tr(value) {
  const source = String(value == null ? "" : value);
  const trimmed = _normKeyText(source);
  if (!trimmed) return source;
  const key = _copyIndex[trimmed];
  if (!key) return source;
  const table = (UI_COPY[key] || (I18N[_uiLang] && I18N[_uiLang][key] ? { [_uiLang]: I18N[_uiLang][key], en: I18N.en[key] } : null));
  if (!table) return source;
  const translated = table[_uiLang] || table.en || trimmed;
  const lead = (source.match(/^\s*/) || [""])[0];
  const trail = (source.match(/\s*$/) || [""])[0];
  return lead + translated + trail;
}

// Python sends activity/log details as readable English strings. Translate
// those runtime messages at the final rendering boundary so logs, history and
// progress cards follow the selected UI language too.
function translate_runtime_text(value) {
  let text = String(value == null ? "" : value);
  const exact = tr(text);
  if (exact !== text) return exact;
  const replacements = [
    [/^OK\s*[—-]/i, t("runtime.ok_prefix") + " —"],
    [/^Skipped\s*[—-]/i, t("runtime.skipped_prefix") + " —"],
    [/^\[ERROR\]\s*/i, t("runtime.error_prefix") + ": "],
    [/^\[WARNING\]\s*/i, t("runtime.warning_prefix") + ": "],
    [/^\[INFO\]\s*/i, ""],
    [/\bBrowser hidden mode:\s*ON\b/gi, t("runtime.browser_hidden_on")],
    [/\bBrowser hidden mode:\s*OFF\b/gi, t("runtime.browser_hidden_off")],
    [/\bAutomatic quest detection failed\b/gi, t("runtime.quest_detect_failed")],
    [/\bError loading WebDriver\b/gi, t("runtime.webdriver_error")],
    [/\bRefreshing points balance…?/gi, t("runtime.refreshing_balance")],
    [/\bPoints balance updated\b/gi, t("runtime.balance_updated")],
    [/\bSwitched to account\b/gi, t("runtime.switched_account")],
    [/\bStatistics reset\b/gi, t("runtime.stats_reset")],
    [/\bGold Member\b/gi, t("gold_member")],
    [/\bSilver Member\b/gi, t("silver_member")],
    [/\bBronze Member\b/gi, t("bronze_member")],
    [/\bLevel\s+(\d+)\b/gi, (_uiLang === "zh" ? "等级 $1" : (_uiLang === "pt" ? "Nível $1" : (_uiLang === "es" ? "Nivel $1" : "Level $1")))],
    [/\bpts\/day\b/gi, t("pts_per_day")],
    [/\bOpening Edge\b/gi, t("runtime.opening_edge")],
    [/\bEdge is ready\./gi, t("runtime.edge_ready")],
    [/already complete today, skipping\./gi, t("runtime.already_complete")],
    [/not listed on today's dashboard, skipping\./gi, t("runtime.not_listed")],
    [/not complete, running\./gi, t("runtime.not_complete_running")],
    [/\balready done\b/gi, t("runtime.already_done")],
    [/\bcredited\b/gi, t("runtime.credited")],
    [/\bVisual Search\b/gi, t("visual_searches")],
    [/\bDaily Set\b/gi, t("daily_tasks")],
    [/\bEdge browsing\b/gi, t("edge_minutes")],
    [/\bBing app streak\b/gi, t("phone")],
    [/\bCheck-in\b/gi, t("checkin")],
    [/\bNews\b/g, t("news")],
    [/\bMobile app\b/gi, t("label.mobile")],
  ];
  replacements.forEach(function (pair) { text = text.replace(pair[0], pair[1]); });
  return text;
}

function tf(key, values) {
  let text = t(key);
  Object.keys(values || {}).forEach(function (name) {
    text = text.replace(new RegExp("\\{" + name + "\\}", "g"), values[name]);
  });
  return text;
}

let _uiLang = (function () {
  try {
    const saved = localStorage.getItem("ar_ui_lang");
    if (saved && I18N[saved]) return saved;
  } catch (e) {}
  return resolve_lang_from_settings({});
})();
let _translationObserver = null;
let _isTranslatingDom = false;

function t(key) {
  const pack = I18N[_uiLang] || I18N.en;
  if (pack[key]) return pack[key];
  if (I18N.en[key]) return I18N.en[key];
  if (UI_COPY[key]) return UI_COPY[key][_uiLang] || UI_COPY[key].en || key;
  return key;
}

function set_ui_lang(lang) {
  _uiLang = ["en", "es", "pt", "zh"].indexOf(lang) >= 0 ? lang : "en";
  try {
    localStorage.setItem("ar_ui_lang", _uiLang);
  } catch (e) {}
  if (document.documentElement) document.documentElement.lang = _uiLang;
  _isTranslatingDom = true;
  if (_translationObserver) {
    try { _translationObserver.disconnect(); } catch (e) {}
  }
  try {
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      const key = el.getAttribute("data-i18n");
      if (!key) return;
      const translated = t(key);
      if (translated === key) return;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
        el.placeholder = translated;
      } else if (el.children.length) {
        if (el.firstChild && el.firstChild.nodeType === Node.TEXT_NODE) {
          el.firstChild.nodeValue = translated + " ";
        }
      } else {
        el.textContent = translated;
      }
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
      const key = el.getAttribute("data-i18n-placeholder");
      if (key) el.placeholder = t(key);
    });
    document.querySelectorAll("[data-i18n-title]").forEach(function (el) {
      const key = el.getAttribute("data-i18n-title");
      if (key) {
        el.title = t(key);
        el.setAttribute("aria-label", t(key));
      }
    });
    translate_document();
    refresh_language_options();
    const startLabel = document.querySelector("#start_btn .btn-label");
    if (
      startLabel &&
      typeof runInProgress !== "undefined" &&
      !runInProgress &&
      typeof driverWarmingUp !== "undefined" &&
      !driverWarmingUp
    ) {
      startLabel.textContent = t("run.start");
    }
    const tasksBtn = document.getElementById("tasks_only_btn");
    if (tasksBtn) tasksBtn.textContent = t("run.tasks");
    const stopLabel = document.querySelector("#stop_btn .stop-label");
    if (stopLabel && !/Stopping|Parando/.test(stopLabel.textContent)) stopLabel.textContent = t("run.stop");
    if (typeof update_status_indicator === "function") update_status_indicator();
    if (typeof render_account_trigger === "function") render_account_trigger();
    if (typeof render_account_menu === "function") render_account_menu();
    if (typeof render_accounts_section === "function" && typeof accountsCache !== "undefined") {
      render_accounts_section(accountsCache);
    }
    if (typeof render_manual_tasks === "function" && typeof _manual_tasks_cache !== "undefined" && _manual_tasks_cache) {
      render_manual_tasks(_manual_tasks_cache);
    }
    if (typeof refresh_rewards_overview === "function") refresh_rewards_overview();
    if (typeof refresh_phone_ui === "function") refresh_phone_ui();
    if (typeof render_current_stats === "function" && typeof _last_dashboard_stats !== "undefined" && _last_dashboard_stats) render_current_stats(_last_dashboard_stats);
    if (typeof render_history === "function") render_history();
    if (typeof showAppVersion === "function") showAppVersion();
    if (typeof updateBingUi === "function") updateBingUi();
  } finally {
    _isTranslatingDom = false;
    start_translation_observer();
  }
}

function resolve_lang_from_settings(settings) {
  const s = settings || {};
  if (s.ui_locale && ["en", "es", "pt", "zh"].indexOf(s.ui_locale) >= 0) return s.ui_locale;
  const pref = String(s.ui_language || "auto").toLowerCase();
  if (["en", "es", "pt", "zh"].indexOf(pref) >= 0) return pref;
  const candidates = [
    s.windows_locale,
    s.detected_locale,
    typeof navigator !== "undefined" ? navigator.language : "",
  ];
  for (let i = 0; i < candidates.length; i++) {
    const raw = String(candidates[i] || "").trim().toLowerCase();
    if (!raw) continue;
    const primary = raw.split(/[-_.\s]/)[0];
    if (["en", "es", "pt", "zh"].indexOf(primary) >= 0) return primary;
  }
  return "en";
}

function translate_node(node) {
  if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
  if (["SCRIPT", "STYLE", "CODE", "PRE"].indexOf(node.tagName) >= 0) return;
  if (node.tagName === "OPTION" && node.hasAttribute("data-language-option")) return;
  ["title", "placeholder", "aria-label", "alt"].forEach(function (name) {
    if (node.hasAttribute && node.hasAttribute(name)) {
      if (name === "placeholder" && node.hasAttribute("data-i18n-placeholder")) return;
      if ((name === "title" || name === "aria-label") && node.hasAttribute("data-i18n-title")) return;
      const origAttr = "data-i18n-orig-" + name;
      const lastAttr = "data-i18n-last-" + name;
      const current = node.getAttribute(name);
      const orig = (node.hasAttribute(origAttr) && current === node.getAttribute(lastAttr))
        ? node.getAttribute(origAttr)
        : current;
      const translated = tr(orig);
      if (translated !== orig || node.hasAttribute(origAttr)) {
        node.setAttribute(origAttr, orig);
        node.setAttribute(lastAttr, translated);
        if (translated !== current) node.setAttribute(name, translated);
      }
    }
  });
  const hasExplicitKey = node.hasAttribute && node.hasAttribute("data-i18n");
  Array.prototype.forEach.call(node.childNodes, function (child) {
    if (child.nodeType === Node.TEXT_NODE) {
      if (hasExplicitKey) return;
      const current = child.nodeValue;
      const orig = (child.__i18nOrig && current === child.__i18nLast)
        ? child.__i18nOrig
        : current;
      const translated = tr(orig);
      if (translated !== orig || child.__i18nOrig) {
        child.__i18nOrig = orig;
        child.__i18nLast = translated;
        if (translated !== current) child.nodeValue = translated;
      }
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      translate_node(child);
    }
  });
}

function translate_document() {
  if (typeof document === "undefined" || !document.body) return;
  if (document.title) {
    const origTitle = (document.__i18nOrigTitle && document.title === document.__i18nLastTitle)
      ? document.__i18nOrigTitle
      : document.title;
    const nextTitle = tr(origTitle);
    document.__i18nOrigTitle = origTitle;
    document.__i18nLastTitle = nextTitle;
    document.title = nextTitle;
  }
  translate_node(document.body);
}

function start_translation_observer() {
  if (typeof MutationObserver === "undefined" || !document.body) return;
  if (!_translationObserver) {
    _translationObserver = new MutationObserver(function (mutations) {
      if (_isTranslatingDom) return;
      _isTranslatingDom = true;
      try {
        mutations.forEach(function (mutation) {
          if (mutation.type === "characterData") {
            const parent = mutation.target.parentElement;
            if (!parent || ["SCRIPT", "STYLE", "CODE", "PRE"].indexOf(parent.tagName) >= 0) return;
            if (parent.hasAttribute && (parent.hasAttribute("data-i18n") || parent.hasAttribute("data-language-option"))) return;
            const current = mutation.target.nodeValue;
            if (current === mutation.target.__i18nLast) return;
            const translated = tr(current);
            if (translated !== current) {
              mutation.target.__i18nOrig = current;
              mutation.target.__i18nLast = translated;
              mutation.target.nodeValue = translated;
            }
          }
          mutation.addedNodes.forEach(function (node) {
            if (node.nodeType === Node.ELEMENT_NODE) translate_node(node);
            if (node.nodeType === Node.TEXT_NODE && node.parentElement) {
              const translated = tr(node.nodeValue);
              if (translated !== node.nodeValue) {
                node.__i18nOrig = node.nodeValue;
                node.__i18nLast = translated;
                node.nodeValue = translated;
              }
            }
          });
        });
      } finally {
        _isTranslatingDom = false;
      }
    });
  }
  try {
    _translationObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
  } catch (e) {}
}

window.addEventListener("DOMContentLoaded", function () {
  set_ui_lang(_uiLang);
});

window.addEventListener("pywebviewready", function () {
  if (!window.pywebview || !pywebview.api || !pywebview.api.get_settings) return;
  pywebview.api.get_settings().then(function (settings) {
    if (settings && settings.windows_locale) {
      window.__arWindowsLocale = settings.windows_locale;
    }
    set_ui_lang(resolve_lang_from_settings(settings || {}));
  }).catch(function () {
    translate_document();
  });
});

const UI_LANGUAGE_NAMES = {
  en: { native: "English", en: "English", es: "Inglés", pt: "Inglês", zh: "英语" },
  es: { native: "Español", en: "Spanish", es: "Español", pt: "Espanhol", zh: "西班牙语" },
  pt: { native: "Português", en: "Portuguese", es: "Portugués", pt: "Português", zh: "葡萄牙语" },
  zh: { native: "中文", en: "Chinese", es: "Chino", pt: "Chinês", zh: "中文" },
};

function refresh_language_options() {
  const selector = document.getElementById("uiLanguageSelect");
  if (!selector) return;
  const systemLanguage = resolve_lang_from_settings({
    ui_language: "auto",
    windows_locale: (window.__arWindowsLocale) || (typeof navigator !== "undefined" ? navigator.language : "en"),
  });
  const autoOption = selector.querySelector('option[value="auto"]');
  if (autoOption) autoOption.textContent = t("settings.language_auto");
  selector.querySelectorAll("option[data-language-option]").forEach(function (option) {
    const code = option.getAttribute("data-language-option");
    const names = UI_LANGUAGE_NAMES[code] || UI_LANGUAGE_NAMES.en;
    option.textContent = `${names.native} (${names[_uiLang] || names[systemLanguage] || names.en})`;
  });
}
