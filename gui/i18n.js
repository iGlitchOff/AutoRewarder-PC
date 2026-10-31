/* AutoRewarder UI & Runtime Localization (en, es, pt, zh). */
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
    "pair.hint": "On the phone, enter or scan this code. The phone finds this PC automatically. Uses the same Microsoft account.",
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
    "progress.reset": "Reset",
    "activity": "Activity",
    "history": "View history",
  },
  es: {
    "run.start": "Iniciar",
    "run.tasks": "Solo tareas",
    "run.stop": "Detener",
    "run.running": "Ejecutando…",
    "run.loading": "Cargando…",
    "run.stopping": "Deteniendo…",
    "run.no_microsoft": "No hay cuenta Microsoft seleccionada.",
    "run.microsoft_setup": "Falta completar la configuración de la cuenta Microsoft.",
    "run.already_running": "Ya hay una ejecución en curso.",
    "run.browser_loading": "Espera a que termine de cargar el navegador.",
    "run.browser_busy": "Espera a que el navegador termine.",
    "run.phone_offline": "No hay celular vinculado o está desconectado.",
    "run.no_phone": "No hay celular vinculado a esta cuenta Microsoft.",
    "pair.title": "Vincular un celular",
    "pair.hint": "En el celular, escribe o escanea este código. El teléfono encuentra este PC automáticamente. Usa la misma cuenta Microsoft.",
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
    "status.daily": "Tareas diarias",
    "rewards.estimate": "Estimado de búsquedas",
    "rewards.region_unknown": "Región desconocida",
    "rewards.unverified": "Sin verificar",
    "progress.daily": "Diarias",
    "progress.visual": "Visual",
    "progress.checkin": "Check-in",
    "progress.news": "Noticias",
    "progress.edge": "Edge",
    "progress.reset": "Reinicio",
    "activity": "Actividad",
    "history": "Ver historial",
  },
};

I18N.pt = {
  ...I18N.en,
  "run.start": "Iniciar",
  "run.tasks": "Somente tarefas",
  "run.stop": "Parar",
  "run.running": "Executando…",
  "run.loading": "Carregando…",
  "run.stopping": "Parando…",
  "run.no_microsoft": "Nenhuma conta Microsoft selecionada.",
  "run.microsoft_setup": "A configuração da conta Microsoft não foi concluída.",
  "run.already_running": "Já existe uma execução em andamento.",
  "run.browser_loading": "Aguarde o navegador terminar de carregar.",
  "run.browser_busy": "Aguarde o navegador terminar.",
  "run.phone_offline": "Nenhum celular vinculado ou está offline.",
  "run.no_phone": "Nenhum celular vinculado a esta conta Microsoft.",
  "pair.title": "Vincular um celular",
  "pair.hint": "No celular, digite ou escaneie este código. O celular encontra este PC automaticamente. Usa a mesma conta Microsoft.",
  "pair.copy": "Copiar código",
  "pair.copied": "Código copiado.",
  "pair.waiting": "Iniciando vínculo remoto…",
  "pair.ready": "Escaneie o QR ou digite o código no celular.",
  "settings.language": "Idioma",
  "settings.language_hint": "Automático usa o Windows / região. Aplica-se a este PC e ao celular vinculado.",
  "settings.language_auto": "Automático (Windows / região)",
  "settings.language_en": "Inglês",
  "settings.language_es": "Espanhol",
  "settings.language_pt": "Português",
  "settings.language_zh": "Chinês",
  "label.mobile": "Celular",
  "status.daily": "Tarefas diárias",
  "rewards.estimate": "Estimativa de pesquisas",
  "rewards.region_unknown": "Região desconhecida",
  "rewards.unverified": "Não verificado",
  "progress.daily": "Diárias",
  "progress.visual": "Visual",
  "progress.checkin": "Check-in",
  "progress.news": "Notícias",
  "progress.edge": "Edge",
  "progress.reset": "Reinício",
  "activity": "Atividade",
  "history": "Ver histórico",
};

I18N.zh = {
  ...I18N.en,
  "run.start": "开始运行",
  "run.tasks": "仅任务",
  "run.stop": "停止",
  "run.running": "运行中…",
  "run.loading": "加载中…",
  "run.stopping": "正在停止…",
  "run.no_microsoft": "未选择 Microsoft 账户。",
  "run.microsoft_setup": "Microsoft 账户尚未完成初始设置。",
  "run.already_running": "已有任务正在运行。",
  "run.browser_loading": "请等待浏览器加载完成。",
  "run.browser_busy": "请等待浏览器完成操作。",
  "run.phone_offline": "未关联手机或手机离线。",
  "run.no_phone": "此 Microsoft 账户未关联手机。",
  "pair.title": "关联手机",
  "pair.hint": "在手机上输入或扫描此代码。手机会自动连接此电脑，并使用同一个 Microsoft 账户。",
  "pair.copy": "复制代码",
  "pair.copied": "代码已复制。",
  "pair.waiting": "正在启动远程连接…",
  "pair.ready": "在手机上扫描二维码或输入代码。",
  "settings.language": "语言",
  "settings.language_hint": "自动模式使用 Windows / 地区设置，同时应用于电脑和已关联的手机。",
  "settings.language_auto": "自动（Windows / 地区）",
  "settings.language_en": "英语",
  "settings.language_es": "西班牙语",
  "settings.language_pt": "葡萄牙语",
  "settings.language_zh": "中文",
  "label.mobile": "手机",
  "status.daily": "每日任务",
  "rewards.estimate": "搜索积分预估",
  "rewards.region_unknown": "未知地区",
  "rewards.unverified": "未验证",
  "progress.daily": "每日",
  "progress.visual": "视觉",
  "progress.checkin": "签到",
  "progress.news": "新闻",
  "progress.edge": "Edge",
  "progress.reset": "重置",
  "activity": "活动",
  "history": "查看历史记录",
};

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
  "refresh": { en: "Refresh", es: "Actualizar", pt: "Atualizar", zh: "刷新" },
  "checking": { en: "Checking…", es: "Buscando…", pt: "Verificando…", zh: "正在检查…" },
  "downloading": { en: "Downloading…", es: "Descargando…", pt: "Baixando…", zh: "正在下载…" },
  "update.title": { en: "Updating AutoRewarder", es: "Actualizando AutoRewarder", pt: "Atualizando o AutoRewarder", zh: "正在更新 AutoRewarder" },
  "update.downloading": { en: "Downloading…", es: "Descargando…", pt: "Baixando…", zh: "正在下载…" },
  "update.installing": { en: "Installing", es: "Instalando", pt: "Instalando", zh: "正在安装" },
  "update.replacing": { en: "Replacing old version", es: "Reemplazando versión anterior", pt: "Substituindo a versão antiga", zh: "正在替换旧版本" },
  "update.cleaning": { en: "Cleaning up", es: "Limpiando archivos temporales", pt: "Limpando arquivos temporários", zh: "正在清理旧文件" },
  "update.finished": { en: "Finished", es: "Finalizado", pt: "Finalizado", zh: "已完成" },
  "update.error": { en: "The update could not be installed.", es: "No se pudo instalar la actualización.", pt: "Não foi possível instalar a atualização.", zh: "无法安装更新。" },
  "update.detail": { en: "Please keep AutoRewarder open.", es: "Mantén AutoRewarder abierto.", pt: "Mantenha o AutoRewarder aberto.", zh: "请保持 AutoRewarder 打开。" },
  "check_updates": { en: "Check updates", es: "Buscar actualizaciones", pt: "Verificar atualizações", zh: "检查更新" },
  "check_for_updates": { en: "Check for updates", es: "Buscar actualizaciones", pt: "Verificar atualizações", zh: "检查更新" },
  "run": { en: "Run", es: "Ejecutar", pt: "Executar", zh: "运行" },
  "for_you": { en: "For you", es: "Para ti", pt: "Para você", zh: "为你推荐" },
  "start_run": { en: "Start run", es: "Iniciar", pt: "Iniciar", zh: "开始运行" },
  "manual_tasks": { en: "Manual tasks", es: "Tareas manuales", pt: "Tarefas manuais", zh: "手动任务" },
  "activity": { en: "Activity", es: "Actividad", pt: "Atividade", zh: "活动" },
  "background_logs": { en: "Background logs", es: "Registros en 2.º plano", pt: "Logs em 2.º plano", zh: "后台日志" },
  "background_logs.subtitle": { en: "Logs from scheduled and headless runs.", es: "Registros de ejecuciones programadas y en segundo plano.", pt: "Logs de execuções agendadas e em segundo plano.", zh: "来自计划任务和无头运行的日志。" },
  "settings.manual_delay_title": { en: "Pause between manual searches", es: "Pausa entre búsquedas manuales", pt: "Pausa entre pesquisas manuais", zh: "手动搜索之间的暂停" },
  "settings.manual_delay_hint": { en: "Sets a random pause between search queries during a normal manual run. Does not apply to scheduled runs or Advanced scheduling.", es: "Define una pausa aleatoria entre consultas durante una ejecución manual normal. No aplica a ejecuciones programadas ni con programación avanzada.", pt: "Define uma pausa aleatória entre pesquisas em uma execução manual normal. Não se aplica a execuções agendadas.", zh: "在正常手动运行期间设置搜索查询之间的随机暂停。不适用于计划运行或高级计划。" },
  "settings.manual_delay_min": { en: "MINIMUM, SECONDS", es: "MÍNIMO (SEGUNDOS)", pt: "MÍNIMO (SEGUNDOS)", zh: "最小秒数" },
  "settings.manual_delay_max": { en: "MAXIMUM, SECONDS", es: "MÁXIMO (SEGUNDOS)", pt: "MÁXIMO (SEGUNDOS)", zh: "最大秒数" },
  "stats": { en: "Stats", es: "Estadísticas", pt: "Estatísticas", zh: "统计" },
  "dashboard": { en: "Dashboard", es: "Panel", pt: "Painel", zh: "仪表板" },
  "history": { en: "View history", es: "Ver historial", pt: "Ver histórico", zh: "查看历史记录" },
  "queries": { en: "Queries", es: "Búsquedas", pt: "Pesquisas", zh: "搜索次数" },
  "total_points": { en: "Total points", es: "Puntos totales", pt: "Pontos totais", zh: "总积分" },
  "earned_today": { en: "Earned today", es: "Ganados hoy", pt: "Ganhos hoje", zh: "今日获得" },
  "rewards_overview": { en: "Rewards overview", es: "Resumen de Rewards", pt: "Resumo do Rewards", zh: "Rewards 概览" },
  "search_estimate": { en: "Search estimate", es: "Estimado de búsquedas", pt: "Estimativa de pesquisas", zh: "搜索估算" },
  "daily_tasks": { en: "Daily tasks", es: "Tareas diarias", pt: "Tarefas diárias", zh: "每日任务" },
  "ready": { en: "Ready", es: "Listo", pt: "Pronto", zh: "就绪" },
  "ready_to_run": { en: "Ready to run", es: "Listo para ejecutar", pt: "Pronto para executar", zh: "准备就绪" },
  "setup_pending": { en: "Setup pending", es: "Configuración pendiente", pt: "Configuração pendente", zh: "待设置" },
  "loading": { en: "Loading…", es: "Cargando…", pt: "Carregando…", zh: "正在加载…" },
  "detecting": { en: "Detecting…", es: "Detectando…", pt: "Detectando…", zh: "正在检测…" },
  "detecting_dots": { en: "Detecting...", es: "Detectando…", pt: "Detectando…", zh: "正在检测…" },
  "membership_unavailable": { en: "Membership unavailable", es: "Membresía no disponible", pt: "Associação indisponível", zh: "会员信息不可用" },
  "needs_you": { en: "Needs you", es: "Requiere tu atención", pt: "Precisa de você", zh: "需要你处理" },
  "ignored": { en: "Ignored", es: "Ignoradas", pt: "Ignoradas", zh: "已忽略" },
  "open": { en: "Open", es: "Abrir", pt: "Abrir", zh: "打开" },
  "ignore": { en: "Ignore", es: "Ignorar", pt: "Ignorar", zh: "忽略" },
  "unignore": { en: "Unignore", es: "Restaurar", pt: "Restaurar", zh: "取消忽略" },
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
  "run_on_pc": { en: "Run on PC", es: "Ejecutar en el PC", pt: "Executar no PC", zh: "在电脑上运行" },
  "start_on_pc": { en: "Start on PC", es: "Iniciar en PC", pt: "Iniciar no PC", zh: "在电脑上开始" },
  "tasks_only": { en: "Tasks only", es: "Solo tareas", pt: "Somente tarefas", zh: "仅任务" },
  "stop": { en: "Stop", es: "Detener", pt: "Parar", zh: "停止" },
  "checkin": { en: "Check-in", es: "Check-in", pt: "Check-in", zh: "签到" },
  "checkins": { en: "Check-ins", es: "Check-ins", pt: "Check-ins", zh: "签到次数" },
  "news": { en: "News", es: "Noticias", pt: "Notícias", zh: "新闻" },
  "all": { en: "All", es: "Todas", pt: "Todos", zh: "全部" },
  "success": { en: "Success", es: "Correcto", pt: "Sucesso", zh: "成功" },
  "errors": { en: "Errors", es: "Errores", pt: "Erros", zh: "错误" },
  "date": { en: "Date", es: "Fecha", pt: "Data", zh: "日期" },
  "time": { en: "Time", es: "Hora", pt: "Hora", zh: "时间" },
  "status": { en: "Status", es: "Estado", pt: "Status", zh: "状态" },
  "points": { en: "Points", es: "Puntos", pt: "Pontos", zh: "积分" },
  "last_run": { en: "Last run", es: "Última ejecución", pt: "Última execução", zh: "上次运行" },
  "statistics": { en: "Statistics", es: "Estadísticas", pt: "Estatísticas", zh: "统计" },
  "execution_history": { en: "Execution history", es: "Historial de ejecuciones", pt: "Histórico de execuções", zh: "执行历史" },
  "refresh_balance": { en: "Refresh balance", es: "Actualizar saldo", pt: "Atualizar saldo", zh: "刷新余额" },
  "refreshing": { en: "Refreshing…", es: "Actualizando…", pt: "Atualizando…", zh: "正在刷新…" },
  "no_activity": { en: "No activity recorded today", es: "No hay actividad registrada hoy", pt: "Nenhuma atividade registrada hoje", zh: "今天没有记录的活动" },
  "no_activity_yet": { en: "No activity recorded yet. Start a run from the main window.", es: "Aún no hay actividad registrada. Inicia una ejecución desde la ventana principal.", pt: "Ainda não há atividade registrada. Inicie uma execução na janela principal.", zh: "尚无活动记录。请从主窗口开始运行。" },
  "language": { en: "Language", es: "Idioma", pt: "Idioma", zh: "语言" },
  "provider": { en: "Provider", es: "Proveedor", pt: "Provedor", zh: "提供商" },
  "model": { en: "Model", es: "Modelo", pt: "Modelo", zh: "模型" },
  "base_url": { en: "Base URL", es: "URL base", pt: "URL base", zh: "基础 URL" },
  "api_key": { en: "API key", es: "Clave API", pt: "Chave da API", zh: "API 密钥" },
  "default_provider": { en: "Default for provider", es: "Predeterminado del proveedor", pt: "Padrão do provedor", zh: "使用提供商默认值" },
  "your_api_key": { en: "Your own API key", es: "Tu propia clave API", pt: "Sua própria chave da API", zh: "你的 API 密钥" },
  "close_to_tray": { en: "Close to tray", es: "Cerrar a la bandeja", pt: "Fechar na bandeja", zh: "关闭到系统托盘" },
  "hide_browser": { en: "Hide browser", es: "Ocultar navegador", pt: "Ocultar navegador", zh: "隐藏浏览器" },
  "hide_browser_hint": { en: "Run Edge in the background (headless). Off by default. Saved automatically when you toggle it.", es: "Ejecuta Edge en segundo plano (oculto). Desactivado por defecto. Se guarda al cambiarlo.", pt: "Executa o Edge em segundo plano (oculto). Desativado por padrão. Salvo automaticamente.", zh: "在后台（无头模式）运行 Edge。默认关闭，切换时自动保存。" },
  "force_daily": { en: "Force daily tasks", es: "Forzar tareas diarias", pt: "Forçar tarefas diárias", zh: "强制每日任务" },
  "force_daily_hint": { en: "Run the Daily Set and More Activities even when today is already marked as done. Cards that are genuinely complete are still skipped.", es: "Ejecuta las tareas diarias y más actividades aunque hoy ya figure como completado. Las tarjetas ya completadas se siguen omitiendo.", pt: "Executa o Conjunto Diário e Mais Atividades mesmo que o dia já esteja marcado como concluído.", zh: "即使今天已标记为完成，仍运行每日任务集和更多活动。真正完成的卡片仍会跳过。" },
  "force_visual": { en: "Force visual search", es: "Forzar búsqueda visual", pt: "Forçar pesquisa visual", zh: "强制视觉搜索" },
  "force_visual_hint": { en: "Run the visual search even when today is already marked as done. A different image is used each time.", es: "Ejecuta la búsqueda visual aunque hoy ya figure como completada. Se usa una imagen distinta cada vez.", pt: "Executa a pesquisa visual mesmo quando hoje já está marcado como concluído. Uma imagem diferente é usada a cada vez.", zh: "即使今天已标记为完成，仍运行视觉搜索。每次使用不同的图片。" },
  "daily_tasks_group_hint": { en: "A task that already ran today is skipped on the next run. Turn these on to run it again anyway.", es: "Una tarea que ya se ejecutó hoy se omite en la siguiente ejecución. Activa estas opciones para repetirla de todos modos.", pt: "Uma tarefa que já foi executada hoje é ignorada na próxima execução. Ative estas opções para executá-la novamente.", zh: "今天已运行的任务在下次运行时会跳过。开启这些选项可强制重新运行。" },
  "ai_terms_hint": { en: "Use your own LLM API key to generate fresh queries in your language on each run. Falls back to the built-in list if generation fails.", es: "Usa tu propia clave API de IA para generar búsquedas nuevas en tu idioma en cada ejecución. Si falla, usa la lista integrada.", pt: "Use sua própria chave de API de LLM para gerar novas pesquisas no seu idioma a cada execução.", zh: "每次运行时使用你自己的 LLM API 密钥以你的语言生成新搜索词。如果生成失败则回退到内置列表。" },
  "schedule_group_hint": { en: "One schedule per account. Each run fires at a random minute inside its window for a natural look.", es: "Un horario por cuenta. Cada ejecución inicia en un minuto aleatorio para mayor naturalidad.", pt: "Um agendamento por conta. Cada execução inicia em um minuto aleatório para parecer natural.", zh: "每个账户独立计划。每次运行会在时间窗口内随机分钟触发，更加自然。" },
  "schedule_empty_hint": { en: "No accounts yet. Add one first to schedule a run.", es: "Aún no hay cuentas. Agrega una primero para programar una ejecución.", pt: "Ainda não há contas. Adicione uma primeiro para agendar uma execução.", zh: "暂无账户。请先添加账户以设置计划运行。" },
  "run_running": { en: "Running…", es: "Ejecutando…", pt: "Executando…", zh: "正在运行…" },
  "run_stopping": { en: "Stopping…", es: "Deteniendo…", pt: "Parando…", zh: "正在停止…" },
  "status.running": { en: "Running", es: "En ejecución", pt: "Em execução", zh: "正在运行" },
  "status.ready": { en: "Ready", es: "Listo", pt: "Pronto", zh: "就绪" },
  "status.setup": { en: "Setup required", es: "Configuración requerida", pt: "Configuração necessária", zh: "需要设置" },
  "status.no_account": { en: "No account selected", es: "Sin cuenta seleccionada", pt: "Nenhuma conta selecionada", zh: "未选择账户" },
  "done": { en: "done", es: "hecho", pt: "concluído", zh: "已完成" },
  "partial": { en: "partial", es: "parcial", pt: "parcial", zh: "部分完成" },
  "pending": { en: "pending", es: "pendiente", pt: "pendente", zh: "待处理" },
  "no_phone_offline": { en: "Phone offline", es: "Celular desconectado", pt: "Celular offline", zh: "手机离线" },
  "no_phone_linked": { en: "No phone linked", es: "Sin celular vinculado", pt: "Nenhum celular vinculado", zh: "未关联手机" },
  "activity_empty": { en: "Activity log is empty.", es: "El registro de actividad está vacío.", pt: "O registro de atividade está vazio.", zh: "活动记录为空。" },
  "activity_copied": { en: "Activity log copied.", es: "Registro de actividad copiado.", pt: "Registro de atividade copiado.", zh: "活动记录已复制。" },
  "settings_saved": { en: "Settings saved.", es: "Configuración guardada.", pt: "Configurações salvas.", zh: "设置已保存。" },
  "save_failed": { en: "Save failed.", es: "No se pudo guardar.", pt: "Não foi possível salvar.", zh: "保存失败。" },
  "settings_load_failed": { en: "Could not load settings.", es: "No se pudo cargar la configuración.", pt: "Não foi possível carregar as configurações.", zh: "无法加载设置。" },
  "account_switch_failed": { en: "Could not switch account. Is the bot running?", es: "No se pudo cambiar de cuenta. ¿El bot está en ejecución?", pt: "Não foi possível trocar de conta. O bot está em execução?", zh: "无法切换账户。机器人正在运行吗？" },
  "account_create_failed": { en: "Could not create account.", es: "No se pudo crear la cuenta.", pt: "Não foi possível criar a conta.", zh: "无法创建账户。" },
  "account_create_running": { en: "Cannot add an account while the bot is running.", es: "No puedes agregar una cuenta mientras el bot está en ejecución.", pt: "Não é possível adicionar uma conta enquanto o bot está em execução.", zh: "机器人运行时无法添加账户。" },
  "account_setup_cancelled": { en: "Setup cancelled — account not created.", es: "Configuración cancelada: la cuenta no fue creada.", pt: "Configuração cancelada — a conta não foi criada.", zh: "设置已取消，未创建账户。" },
  "hide_browser_on": { en: "Hide browser on. Saved.", es: "Navegador oculto activado.", pt: "Navegador oculto ativado.", zh: "已开启隐藏浏览器。" },
  "hide_browser_off": { en: "Hide browser off. Saved.", es: "Navegador oculto desactivado.", pt: "Navegador oculto desativado.", zh: "已关闭隐藏浏览器。" },
  "pc_range": { en: "PC must be between 0 and 130.", es: "PC debe estar entre 0 y 130.", pt: "PC deve estar entre 0 e 130.", zh: "电脑搜索数量必须在 0 到 130 之间。" },
  "mobile_range": { en: "Mobile must be between 0 and 99.", es: "Móvil debe estar entre 0 y 99.", pt: "Celular deve estar entre 0 e 99.", zh: "手机搜索数量必须在 0 到 99 之间。" },
  "choose_queries": { en: "Set at least one of PC or Mobile above 0.", es: "Configura al menos PC o Móvil por encima de 0.", pt: "Defina pelo menos PC ou Celular acima de 0.", zh: "请将电脑或手机中的至少一项设为大于 0。" },
  "phone_pc_found": { en: "PC found. Confirm the code and link.", es: "PC encontrado. Confirma el código y vincula.", pt: "PC encontrado. Confirme o código e vincule.", zh: "已找到电脑。请确认代码并关联。" },
  "phone_pairing": { en: "Linking…", es: "Vinculando…", pt: "Vinculando…", zh: "正在关联…" },
  "phone_searching": { en: "Looking for the PC…", es: "Buscando el PC…", pt: "Procurando o PC…", zh: "正在查找电脑…" },
  "camera_opening": { en: "Opening camera…", es: "Abriendo la cámara…", pt: "Abrindo a câmera…", zh: "正在打开相机…" },
  "camera_android_only": { en: "Camera is only available in the Android app.", es: "La cámara solo está disponible en la app de Android.", pt: "A câmera só está disponível no app Android.", zh: "相机仅在 Android 应用中可用。" },
  "background_run": { en: "Enable Background Auto-Run", es: "Ejecución automática en segundo plano", pt: "Execução automática em segundo plano", zh: "启用后台自动运行" },
  "scheduled_runs": { en: "Scheduled runs", es: "Ejecuciones programadas", pt: "Execuções agendadas", zh: "计划运行" },
  "open_on_login": { en: "Open AutoRewarder when you sign in", es: "Abrir AutoRewarder al iniciar sesión en Windows", pt: "Abrir o AutoRewarder ao entrar no Windows", zh: "登录 Windows 时打开 AutoRewarder" },
  "search_terms": { en: "Search terms", es: "Términos de búsqueda", pt: "Termos de pesquisa", zh: "搜索词" },
  "ai_terms": { en: "Generate search terms with AI (LLM)", es: "Generar términos de búsqueda con IA (LLM)", pt: "Gerar termos de pesquisa com IA (LLM)", zh: "使用 AI（LLM）生成搜索词" },
  "welcome": { en: "Welcome to AutoRewarder", es: "Bienvenido a AutoRewarder", pt: "Bem-vindo ao AutoRewarder", zh: "欢迎使用 AutoRewarder" },
  "person_icon_accounts": { en: "Use the person icon at the top to add or manage accounts.", es: "Usa el botón de abajo o el icono de cuentas arriba para agregar tu cuenta.", pt: "Use o botão abaixo ou o ícone de contas no topo para adicionar sua conta.", zh: "使用下方按钮或顶部账户图标添加你的账户。" },
  "automatic_language": { en: "Automatic (Windows / region)", es: "Automático (Windows / región)", pt: "Automático (Windows / região)", zh: "自动（Windows / 地区）" },
  "language_hint": { en: "Automatic uses Windows / region. Applies to this PC and the linked phone.", es: "Automático usa Windows / región. Aplica a este PC y al celular vinculado.", pt: "Automático usa Windows / região. Aplica-se a este PC e ao celular vinculado.", zh: "自动模式使用 Windows / 地区设置，并应用于此电脑和关联手机。" },
  "close_to_tray_hint": { en: "Clicking X minimizes to the system tray instead of quitting. Takes effect on next launch.", es: "Al pulsar X se minimiza a la bandeja del sistema en lugar de cerrar. Aplica en el próximo inicio.", pt: "Clicar no X minimiza para a bandeja do sistema em vez de fechar. Vale na próxima abertura.", zh: "点击 X 会最小化到系统托盘而不是退出。下次启动时生效。" },
  "llm_key_hint": { en: "Your API key is stored locally in settings.json (plain text). Requests only send a prompt asking for queries — no personal data.", es: "Tu clave API se guarda localmente en settings.json. Las solicitudes solo piden generar consultas, sin enviar datos personales.", pt: "Sua chave da API é armazenada localmente em settings.json. As solicitações enviam apenas um pedido de pesquisas, sem dados pessoais.", zh: "你的 API 密钥仅保存在本地 settings.json 中。请求只会发送生成搜索词的提示，不含个人数据。" },
  "manual_tasks_hint": { en: "Quests and leftover cards from your live /earn page that still need you (or that the bot could not finish). The list is detected and refreshed automatically in the background. Ignore hides until you unignore; Remove hides for good.", es: "Misiones y tarjetas pendientes de tu página /earn que requieren tu acción manual. La lista se detecta y actualiza sola en segundo plano. Ignorar las oculta temporalmente; Eliminar las oculta de forma permanente.", pt: "Missões e cartões pendentes da sua página /earn que ainda precisam de você. A lista é atualizada automaticamente em segundo plano.", zh: "这是 /earn 页面中仍需要你手动处理的任务和卡片。列表会在后台自动检测和刷新。" },
  "all_accounts": { en: "All accounts", es: "Todas las cuentas", pt: "Todas as contas", zh: "所有账户" },
  "lifetime_activity": { en: "Lifetime activity", es: "Actividad histórica", pt: "Atividade total", zh: "累计活动" },
  "recent_activity": { en: "Recent activity (verified points / day)", es: "Actividad reciente (puntos verificados / día)", pt: "Atividade recente (pontos verificados / dia)", zh: "近期活动（每日已验证积分）" },
  "pc_searches": { en: "PC searches", es: "Búsquedas en PC", pt: "Pesquisas no PC", zh: "电脑搜索" },
  "mobile_searches": { en: "Mobile searches", es: "Búsquedas móviles", pt: "Pesquisas no celular", zh: "手机搜索" },
  "daily_cards": { en: "Daily cards", es: "Tarjetas diarias", pt: "Cartões diários", zh: "每日卡片" },
  "earn_cards": { en: "Earn cards", es: "Más actividades", pt: "Mais atividades", zh: "更多活动" },
  "quest_tasks": { en: "Quest tasks", es: "Misiones", pt: "Missões", zh: "任务挑战" },
  "visual_searches": { en: "Visual searches", es: "Búsquedas visuales", pt: "Pesquisas visuais", zh: "视觉搜索" },
  "edge_minutes": { en: "Edge minutes", es: "Minutos en Edge", pt: "Minutos do Edge", zh: "Edge 分钟数" },
  "runs": { en: "Runs", es: "Ejecuciones", pt: "Execuções", zh: "运行次数" },

  // Runtime & Account keys
  "run.loading_short": { en: "Loading…", es: "Cargando…", pt: "Carregando…", zh: "正在加载…" },
  "run.stopping_short": { en: "Stopping…", es: "Deteniendo…", pt: "Parando…", zh: "正在停止…" },
  "run.ready_to_run": { en: "Ready to run", es: "Listo para ejecutar", pt: "Pronto para executar", zh: "准备就绪" },
  "run.setup_pending": { en: "Setup pending", es: "Configuración pendiente", pt: "Configuração pendente", zh: "待设置" },
  "status.pending": { en: "pending", es: "pendiente", pt: "pendente", zh: "待处理" },
  "status.done": { en: "done", es: "completado", pt: "concluído", zh: "已完成" },
  "status.partial": { en: "partial", es: "parcial", pt: "parcial", zh: "部分完成" },
  "status.unknown": { en: "unknown", es: "desconocido", pt: "desconhecido", zh: "未知" },
  "status.resets_midnight": { en: "resets at midnight", es: "se reinicia a medianoche", pt: "reinicia à meia-noite", zh: "午夜重置" },
  "status.current": { en: "Current", es: "Actual", pt: "Atual", zh: "当前" },
  "account.ready": { en: "Ready", es: "Listo", pt: "Pronto", zh: "就绪" },
  "account.ready_to_run": { en: "Ready to run", es: "Listo para ejecutar", pt: "Pronto para executar", zh: "准备就绪" },
  "account.setup_pending": { en: "Setup pending", es: "Configuración pendiente", pt: "Configuração pendente", zh: "待设置" },
  "account.no_account": { en: "No account yet", es: "Sin cuenta configurada", pt: "Ainda não há conta", zh: "暂无账户" },
  "account.select_below": { en: "Select an account", es: "Selecciona una cuenta", pt: "Selecione uma conta", zh: "请选择账户" },
  "account.add_first": { en: "Click to add your first account", es: "Haz clic para agregar tu primera cuenta", pt: "Clique para adicionar sua primeira conta", zh: "点击添加你的第一个账户" },
  "account.current": { en: "Current · ", es: "Actual · ", pt: "Atual · ", zh: "当前 · " },
  "account.rename": { en: "Rename", es: "Renombrar", pt: "Renomear", zh: "重命名" },
  "account.rerun_setup": { en: "Re-run setup", es: "Repetir configuración", pt: "Refazer configuração", zh: "重新设置" },
  "account.run_setup": { en: "Run setup", es: "Configurar", pt: "Configurar", zh: "运行设置" },
  "account.delete": { en: "Delete", es: "Eliminar", pt: "Excluir", zh: "删除" },
  "account.delete_question": { en: "Delete \"{name}\"?", es: "¿Eliminar \"{name}\"?", pt: "Excluir \"{name}\"?", zh: "删除“{name}”？" },
  "account.rename_prompt": { en: "Enter a new name for \"{name}\".", es: "Escribe un nuevo nombre para \"{name}\".", pt: "Digite um novo nome para \"{name}\".", zh: "请输入“{name}”的新名称。" },
  "account.opening_setup": { en: "Opening browser to set up \"{name}\"…", es: "Abriendo el navegador para configurar \"{name}\"…", pt: "Abrindo o navegador para configurar \"{name}\"…", zh: "正在打开浏览器设置“{name}”…" },
  "account.same_microsoft": { en: "Same Microsoft account · mobile companion", es: "Misma cuenta Microsoft · app móvil", pt: "Mesma conta Microsoft · app móvel", zh: "同一个 Microsoft 账户 · 手机端" },

  // Mobile & Bridge keys (every key used by phone.html, phone.js, and PC phone row)
  "phone.brand": { en: "AutoRewarder", es: "AutoRewarder", pt: "AutoRewarder", zh: "AutoRewarder" },
  "phone.updates": { en: "Check updates", es: "Actualizar", pt: "Atualizar", zh: "检查更新" },
  "phone.download": { en: "Download", es: "Descargar", pt: "Baixar", zh: "下载" },
  "phone.cancel": { en: "Cancel", es: "Cancelar", pt: "Cancelar", zh: "取消" },
  "phone.pair": { en: "Link to the PC", es: "Vincular con el PC", pt: "Vincular ao PC", zh: "与电脑关联" },
  "phone.pair_hint": { en: "On the PC: Account → Link a phone. Enter the 6-digit code or scan the QR.", es: "En el PC: Cuenta → Vincular un celular. Escribe el código de 6 dígitos o escanea el QR.", pt: "No PC: Conta → Vincular um celular. Digite o código de 6 dígitos ou escaneie o QR.", zh: "在电脑上：账户 → 关联手机。输入 6 位代码或扫描二维码。" },
  "phone.pair_btn": { en: "Link with PC", es: "Vincular con el PC", pt: "Vincular ao PC", zh: "关联电脑" },
  "phone.looking": { en: "Looking for the PC…", es: "Buscando el PC…", pt: "Procurando o PC…", zh: "正在查找电脑…" },
  "phone.account": { en: "Account", es: "Cuenta", pt: "Conta", zh: "账户" },
  "phone.points": { en: "Points", es: "Puntos", pt: "Pontos", zh: "积分" },
  "phone.total": { en: "Total points", es: "Puntos totales", pt: "Pontos totais", zh: "总积分" },
  "phone.today": { en: "Earned today", es: "Ganados hoy", pt: "Ganhos hoje", zh: "今日获得" },
  "phone.ready_state": { en: "Ready", es: "Listo", pt: "Pronto", zh: "就绪" },
  "phone.setup_state": { en: "Setup pending", es: "Configuración pendiente", pt: "Configuração pendente", zh: "待设置" },
  "phone.by_microsoft": { en: "by Microsoft", es: "por Microsoft", pt: "pela Microsoft", zh: "Microsoft 账户" },
  "phone.by_phone": { en: "on phone", es: "en celular", pt: "no celular", zh: "手机端" },
  "phone.rewards": { en: "Rewards overview", es: "Resumen de Rewards", pt: "Resumo do Rewards", zh: "Rewards 概览" },
  "phone.progress.pc": { en: "PC", es: "PC", pt: "PC", zh: "电脑" },
  "phone.progress.mobile": { en: "Mobile", es: "Móvil", pt: "Celular", zh: "手机" },
  "phone.progress.daily": { en: "Daily", es: "Diarias", pt: "Diárias", zh: "每日" },
  "phone.progress.visual": { en: "Visual", es: "Visual", pt: "Visual", zh: "视觉" },
  "phone.progress.checkin": { en: "Check-in", es: "Check-in", pt: "Check-in", zh: "签到" },
  "phone.progress.news": { en: "News", es: "Noticias", pt: "Notícias", zh: "新闻" },
  "phone.progress.edge": { en: "Edge", es: "Edge", pt: "Edge", zh: "Edge" },
  "phone.progress.reset": { en: "Reset", es: "Reinicio", pt: "Reinício", zh: "重置" },
  "phone.here": { en: "On this phone", es: "En este celular", pt: "Neste celular", zh: "在此手机上" },
  "phone.hint": { en: "Complete check-in and news using the same Microsoft account.", es: "Completa el check-in y las noticias con la misma cuenta Microsoft.", pt: "Conclua o check-in e as notícias com a mesma conta Microsoft.", zh: "使用相同的 Microsoft 账户完成签到和新闻任务。" },
  "phone.run_all": { en: "Automate all (Check-in + News)", es: "Automatizar todo (Check-in + Noticias)", pt: "Automatizar tudo (Check-in + Notícias)", zh: "全部自动运行（签到 + 新闻）" },
  "phone.run_all_short": { en: "Auto-run all", es: "Automatizar todo", pt: "Automatizar tudo", zh: "全部运行" },
  "phone.checkin": { en: "Check-in", es: "Check-in", pt: "Check-in", zh: "签到" },
  "phone.news": { en: "News", es: "Noticias", pt: "Notícias", zh: "新闻" },
  "phone.claim": { en: "Claim points", es: "Reclamar puntos", pt: "Resgatar pontos", zh: "领取积分" },
  "phone.install": { en: "Install Bing", es: "Instalar Bing", pt: "Instalar o Bing", zh: "安装 Bing" },
  "phone.login": { en: "Sign in to Rewards", es: "Iniciar sesión en Rewards", pt: "Entrar no Rewards", zh: "登录 Rewards" },
  "phone.ready": { en: "Check session", es: "Comprobar sesión", pt: "Verificar sessão", zh: "检查会话" },
  "phone.verify": { en: "Check again", es: "Volver a comprobar", pt: "Verificar novamente", zh: "重新检查" },
  "phone.runpc": { en: "Run on the PC", es: "Ejecutar en el PC", pt: "Executar no PC", zh: "在电脑上运行" },
  "phone.start": { en: "Start on PC", es: "Iniciar en PC", pt: "Iniciar no PC", zh: "在电脑上开始" },
  "phone.tasks": { en: "Tasks only", es: "Solo tareas", pt: "Somente tarefas", zh: "仅任务" },
  "phone.edge": { en: "Edge 30 min", es: "Edge 30 min", pt: "Edge 30 min", zh: "Edge 30 分钟" },
  "phone.stop": { en: "Stop", es: "Detener", pt: "Parar", zh: "停止" },
  "phone.activity": { en: "Activity", es: "Actividad", pt: "Atividade", zh: "活动" },
  "phone.unlink": { en: "Unlink this phone", es: "Desvincular este celular", pt: "Desvincular este celular", zh: "取消关联此手机" },
  "phone.linked": { en: "Linked to PC", es: "Vinculado al PC", pt: "Vinculado ao PC", zh: "已关联到电脑" },
  "phone.qr": { en: "Scan QR", es: "Escanear QR", pt: "Escanear QR", zh: "扫描二维码" },
  "phone.online": { en: "Online", es: "En línea", pt: "Online", zh: "在线" },
  "phone.offline": { en: "Offline", es: "Desconectado", pt: "Offline", zh: "离线" },
  "phone.pc_running": { en: "PC is running", es: "El PC está ejecutándose", pt: "O PC está executando", zh: "电脑正在运行" },
  "phone.linked_ready": { en: "Linked to PC · ready", es: "Vinculado al PC · listo", pt: "Vinculado ao PC · pronto", zh: "已关联到电脑 · 就绪" },
  "phone.searches_saved": { en: "Searches saved: PC {pc} / Mobile {mobile}", es: "Búsquedas guardadas: PC {pc} / Móvil {mobile}", pt: "Pesquisas salvas: PC {pc} / Celular {mobile}", zh: "搜索已保存：电脑 {pc} / 手机 {mobile}" },
  "phone.pc_job": { en: "PC requested: {kind}", es: "Solicitado por el PC: {kind}", pt: "Solicitado pelo PC: {kind}", zh: "电脑请求任务：{kind}" },

  // Bing status pills & banners on mobile
  "bing.ready": { en: "Session ready", es: "Sesión lista", pt: "Sessão pronta", zh: "会话已就绪" },
  "bing.nosession": { en: "Sign in required", es: "Falta iniciar sesión", pt: "Login necessário", zh: "需要登录" },
  "bing.disabled": { en: "Bing disabled", es: "Bing desactivado", pt: "Bing desativado", zh: "Bing 已禁用" },
  "bing.missing": { en: "Built-in mode", es: "Modo integrado", pt: "Modo integrado", zh: "内置模式" },
  "bing.off": { en: "The Bing app is disabled in Android Settings.", es: "La app Bing está desactivada en los Ajustes de Android.", pt: "O app Bing está desativado nas Configurações do Android.", zh: "Bing 应用已在 Android 设置中禁用。" },
  "bing.install_banner": { en: "Sign in to Microsoft Rewards to run check-in and news.", es: "Inicia sesión en Microsoft Rewards para ejecutar check-in y noticias.", pt: "Entre no Microsoft Rewards para executar check-in e notícias.", zh: "请登录 Microsoft Rewards 以运行签到和新闻任务。" },

  // Mobile update check banners
  "updates.checking": { en: "Checking…", es: "Buscando…", pt: "Verificando…", zh: "正在检查…" },
  "updates.phone_down": { en: "Downloading APK update…", es: "Descargando actualización APK…", pt: "Baixando atualização do APK…", zh: "正在下载 APK 更新…" },
  "updates.phone_ask": { en: "New mobile update ({tag}) available. Download now?", es: "Nueva versión móvil ({tag}) disponible. ¿Descargar ahora?", pt: "Nova versão móvel ({tag}) disponível. Baixar agora?", zh: "发现新手机版本（{tag}）。是否立即下载？" },
  "updates.no_installer": { en: "Version {tag} found, but no APK is attached.", es: "Se encontró la versión {tag}, pero no incluye archivo APK.", pt: "Versão {tag} encontrada, mas sem arquivo APK.", zh: "已找到版本 {tag}，但未附带 APK 文件。" },
  "updates.github": { en: "Could not check GitHub for updates.", es: "No se pudo consultar actualizaciones en GitHub.", pt: "Não foi possível verificar atualizações no GitHub.", zh: "无法从 GitHub 检查更新。" },
  "updates.phone_none": { en: "You already have the latest version.", es: "Ya tienes la última versión instalada.", pt: "Você já tem a versão mais recente instalada.", zh: "当前已是最新版本。" },

  // Settings & Schedule messages
  "settings.detected_language": { en: "Detected language: {locale}. Leave \"auto\" to follow your system, or enter a locale like fr-FR.", es: "Idioma detectado: {locale}. Deja \"auto\" para usar el del sistema o escribe un código como es-CO.", pt: "Idioma detectado: {locale}. Deixe \"auto\" para seguir o sistema ou informe um código como pt-BR.", zh: "检测到的语言：{locale}。保留“auto”以跟随系统，或输入如 zh-CN 的区域代码。" },
  "settings.windows_only": { en: "Available on Windows only.", es: "Disponible solo en Windows.", pt: "Disponível apenas no Windows.", zh: "仅适用于 Windows。" },
  "settings.windows_linux": { en: "Available on Windows and Linux only.", es: "Disponible solo en Windows y Linux.", pt: "Disponível apenas no Windows e Linux.", zh: "仅适用于 Windows 和 Linux。" },
  "settings.background_hint": { en: "Automatically run AutoRewarder in the background at each account's scheduled time.", es: "Ejecuta AutoRewarder automáticamente en segundo plano a la hora programada de cada cuenta.", pt: "Executa o AutoRewarder automaticamente em segundo plano no horário programado de cada conta.", zh: "在每个账户的计划时间于后台自动运行 AutoRewarder。" },
  "settings.login_hint": { en: "When you sign in to Windows, run leftover searches and daily tasks. If everything is already done, AutoRewarder closes.", es: "Al iniciar sesión en Windows, ejecuta las búsquedas y tareas diarias pendientes. Si todo está completo, se cierra solo.", pt: "Ao entrar no Windows, executa pesquisas e tarefas diárias pendentes. Se tudo estiver concluído, fecha sozinho.", zh: "登录 Windows 时运行剩余搜索和每日任务。若全部完成则自动关闭。" },
  "settings.preparing_driver": { en: "Preparing browser driver…", es: "Preparando controlador del navegador…", pt: "Preparando driver do navegador…", zh: "正在准备浏览器驱动…" },
  "tasks.open": { en: "Open", es: "Abrir", pt: "Abrir", zh: "打开" },
  "tasks.ignore": { en: "Ignore", es: "Ignorar", pt: "Ignorar", zh: "忽略" },
  "tasks.unignore": { en: "Unignore", es: "Restaurar", pt: "Restaurar", zh: "取消忽略" },
  "tasks.remove": { en: "Remove", es: "Eliminar", pt: "Remover", zh: "移除" },
  "tasks.detecting": { en: "Detecting quests automatically from Rewards /earn…", es: "Detectando misiones automáticamente desde Rewards /earn…", pt: "Detectando missões automaticamente no Rewards /earn…", zh: "正在从 Rewards /earn 自动检测任务…" },
  "tasks.empty": { en: "No pending manual quests detected. This list refreshes automatically.", es: "No hay misiones manuales pendientes. Esta lista se actualiza automáticamente.", pt: "Nenhuma missão manual pendente detectada. A lista é atualizada automaticamente.", zh: "未检测到待处理的手动任务。此列表会自动刷新。" },
  "left": { en: "left", es: "restantes", pt: "restantes", zh: "剩余" },
  "by_microsoft": { en: "by Microsoft", es: "por Microsoft", pt: "pela Microsoft", zh: "Microsoft 账户" },
  "schedule_off": { en: "Schedule off", es: "Horario desactivado", pt: "Agendamento desativado", zh: "计划已关闭" },
  "balance_not_verified": { en: "Balance not verified", es: "Saldo sin verificar", pt: "Saldo não verificado", zh: "余额未验证" },
  "balance_not_found": { en: "Balance not found — diagnostic", es: "Saldo no encontrado — diagnóstico", pt: "Saldo não encontrado — diagnóstico", zh: "未找到余额 — 诊断" },
  "diagnostic": { en: "Diagnostic", es: "Diagnóstico", pt: "Diagnóstico", zh: "诊断" },
  "landed_page": { en: "Landed page:", es: "Página cargada:", pt: "Página carregada:", zh: "加载页面：" },
  "selector_matches": { en: "Selector matches:", es: "Coincidencias del selector:", pt: "Correspondências do seletor:", zh: "选择器匹配：" },
  "real_balance": { en: "Real balance", es: "Saldo verificado", pt: "Saldo verificado", zh: "真实余额" },
  "balance_updated": { en: "Real balance · updated {when}", es: "Saldo verificado · actualizado {when}", pt: "Saldo verificado · atualizado {when}", zh: "真实余额 · 更新于 {when}" },
  "today": { en: "Today", es: "Hoy", pt: "Hoje", zh: "今天" },
  "no_activity_today": { en: "No activity recorded today", es: "Sin actividad registrada hoy", pt: "Nenhuma atividade registrada hoje", zh: "今日无活动记录" },
  "news_reads": { en: "News reads", es: "Noticias leídas", pt: "Notícias lidas", zh: "新闻阅读" },
  "daily": { en: "Daily", es: "Diarias", pt: "Diárias", zh: "每日" },
  "earn": { en: "Earn", es: "Actividades", pt: "Atividades", zh: "活动" },
  "quests": { en: "Quests", es: "Misiones", pt: "Missões", zh: "任务" },
  "searches": { en: "Searches", es: "Búsquedas", pt: "Pesquisas", zh: "搜索" },
  "no_accounts_period": { en: "No accounts yet.", es: "Aún no hay cuentas.", pt: "Ainda não há contas.", zh: "暂无账户。" },
  "refresh_failed": { en: "Refresh failed.", es: "Falló la actualización.", pt: "Falha ao atualizar.", zh: "刷新失败。" },
  "refresh_error_no_account": { en: "No account selected.", es: "No hay cuenta seleccionada.", pt: "Nenhuma conta selecionada.", zh: "未选择账户。" },
  "refresh_error_setup": { en: "Complete First Setup for this account first.", es: "Completa primero la configuración inicial de esta cuenta.", pt: "Conclua primeiro a configuração inicial desta conta.", zh: "请先完成此账户的初始设置。" },
  "refresh_error_busy": { en: "Browser busy (a run or startup is using it) — try again in a moment.", es: "El navegador está ocupado; inténtalo en un momento.", pt: "O navegador está ocupado; tente novamente em instantes.", zh: "浏览器正忙，请稍后重试。" },
  "refresh_error_not_found": { en: "Couldn't read the balance from the rewards page.", es: "No se pudo leer el saldo desde la página de Rewards.", pt: "Não foi possível ler o saldo na página do Rewards.", zh: "无法从 Rewards 页面读取余额。" },
  "refresh_error_driver": { en: "Could not open the browser to read the balance.", es: "No se pudo abrir el navegador para leer el saldo.", pt: "Não foi possível abrir o navegador para ler o saldo.", zh: "无法打开浏览器读取余额。" },
  "refresh_error_changed": { en: "Account changed during refresh — try again.", es: "La cuenta cambió durante la actualización; inténtalo de nuevo.", pt: "A conta mudou durante a atualização; tente novamente.", zh: "刷新期间账户已切换，请重试。" },
  "no_points_match": { en: "(no .pointsValue elements matched)", es: "(sin coincidencias de saldo)", pt: "(nenhum elemento de saldo encontrado)", zh: "（未匹配到积分元素）" },
  "unknown": { en: "(unknown)", es: "(desconocido)", pt: "(desconhecido)", zh: "（未知）" },
  "none": { en: "(none)", es: "(ninguno)", pt: "(nenhum)", zh: "（无）" },
  "title_statistics": { en: "Statistics", es: "Estadísticas", pt: "Estatísticas", zh: "统计信息" },
  "title_history": { en: "Execution History", es: "Historial de ejecuciones", pt: "Histórico de execuções", zh: "执行历史" },
  "filter_history": { en: "Filter history", es: "Filtrar historial", pt: "Filtrar histórico", zh: "筛选历史记录" },
  "no_runs_yet": { en: "No runs yet. Start one from the main window.", es: "Aún no hay ejecuciones. Inicia una desde la ventana principal.", pt: "Ainda não há execuções. Inicie uma pela janela principal.", zh: "暂无运行记录。请从主窗口开始运行。" },
  "no_errors_history": { en: "No errors in this history.", es: "No hay errores en este historial.", pt: "Não há erros neste histórico.", zh: "此历史记录中没有错误。" },
  "no_success_history": { en: "No successful entries in this history.", es: "No hay entradas exitosas en este historial.", pt: "Não há entradas bem-sucedidas neste histórico.", zh: "此历史记录中没有成功记录。" },
  "title": { en: "Title:", es: "Título:", pt: "Título:", zh: "标题：" },
  "dismiss": { en: "Dismiss", es: "Cerrar", pt: "Fechar", zh: "关闭" },
  "update_download_failed": { en: "Could not download the update: {error}", es: "No se pudo descargar la actualización: {error}", pt: "Não foi possível baixar a atualização: {error}", zh: "无法下载更新：{error}" },
  "update_no_custom": { en: "You already have the latest version installed.", es: "Ya tienes la última versión instalada.", pt: "Você já tem a versão mais recente instalada.", zh: "当前已是最新版本。" },
  "update_github_failed": { en: "Could not check GitHub for updates.", es: "No se pudo consultar GitHub.", pt: "Não foi possível consultar o GitHub.", zh: "无法检查 GitHub 更新。" },
  "schedule_enable": { en: "Enable schedule", es: "Activar horario", pt: "Ativar agendamento", zh: "启用计划" },
  "schedule_enable_for": { en: "Enable schedule for {name}", es: "Activar horario para {name}", pt: "Ativar agendamento para {name}", zh: "为 {name} 启用计划" },
  "schedule_dashboard": { en: "Rewards dashboard", es: "Panel de Rewards", pt: "Painel do Rewards", zh: "Rewards 面板" },
  "dashboard_auto": { en: "Auto (detect)", es: "Automático (detectar)", pt: "Automático (detectar)", zh: "自动（检测）" },
  "dashboard_legacy": { en: "Legacy", es: "Clásico", pt: "Clássico", zh: "旧版" },
  "dashboard_new": { en: "New", es: "Nuevo", pt: "Novo", zh: "新版" },
  "advanced_scheduling": { en: "Advanced scheduling (drip-feed across duration)", es: "Programación avanzada (distribuir búsquedas en el tiempo)", pt: "Agendamento avançado (distribuir pesquisas no tempo)", zh: "高级计划（在指定时长内分批执行）" },
  "daily_run_time": { en: "Daily run time", es: "Hora de ejecución diaria", pt: "Horário de execução diária", zh: "每日运行时间" },
  "run_duration": { en: "Run duration (h)", es: "Duración (horas)", pt: "Duração (horas)", zh: "运行时长（小时）" },
  "queries_hour": { en: "Queries / hour", es: "Búsquedas / hora", pt: "Pesquisas / hora", zh: "每小时搜索数" },
  "phone_offline_toast": { en: "Phone offline", es: "Celular desconectado", pt: "Celular offline", zh: "手机离线" },
  "phone_unlink_failed": { en: "Could not unlink the phone.", es: "No se pudo desvincular el celular.", pt: "Não foi possível desvincular o celular.", zh: "无法取消关联手机。" },
  "phone_already_unlinked": { en: "Phone was already unlinked.", es: "El celular ya estaba desvinculado.", pt: "O celular já estava desvinculado.", zh: "手机已取消关联。" },
  "pair_failed": { en: "Could not start pairing.", es: "No se pudo iniciar la vinculación.", pt: "Não foi possível iniciar a vinculação.", zh: "无法启动配对。" },
  "phone_online_close": { en: "Phone connected! You can close this window.", es: "¡Celular conectado! Ya puedes cerrar esta ventana.", pt: "Celular conectado! Você já pode fechar esta janela.", zh: "手机已连接！你可以关闭此窗口。" },
  "status.ok": { en: "OK", es: "Correcto", pt: "OK", zh: "成功" },
  "status.skipped": { en: "Skipped", es: "Omitido", pt: "Ignorado", zh: "已跳过" },
  "status.error_prefix": { en: "[ERROR]", es: "[ERROR]", pt: "[ERRO]", zh: "[错误]" },
  "status.warning_prefix": { en: "[WARNING]", es: "[AVISO]", pt: "[AVISO]", zh: "[警告]" },
  "account_switch_error": { en: "Could not switch account while a run is active.", es: "No se puede cambiar de cuenta durante una ejecución.", pt: "Não é possível trocar de conta durante uma execução.", zh: "运行期间无法切换账户。" },
  "account_delete_error": { en: "Could not delete the account. Stop the run and try again.", es: "No se pudo eliminar la cuenta. Detén la ejecución e inténtalo de nuevo.", pt: "Não foi possível excluir a conta. Pare a execução e tente novamente.", zh: "无法删除账户。请停止运行后重试。" },
  "account_deleted": { en: "Account \"{name}\" was deleted.", es: "Se eliminó la cuenta \"{name}\".", pt: "A conta \"{name}\" foi excluída.", zh: "账户“{name}”已删除。" },
  "add_account_title": { en: "Add a new account", es: "Agregar nueva cuenta", pt: "Adicionar nova conta", zh: "添加新账户" },
  "add_account_hint": { en: "Give this account a label — you can rename it anytime.", es: "Escribe un nombre para identificar esta cuenta.", pt: "Dê um nome para identificar esta conta.", zh: "为此账户输入名称，之后可随时修改。" },
  "continue": { en: "Continue", es: "Continuar", pt: "Continuar", zh: "继续" },
  "account_open_login": { en: "Opening Edge for \"{name}\". Sign in to Microsoft Rewards, then close the browser.", es: "Abriendo Edge para \"{name}\". Inicia sesión en Microsoft Rewards y luego cierra el navegador.", pt: "Abrindo o Edge para \"{name}\". Entre no Microsoft Rewards e feche o navegador.", zh: "正在为“{name}”打开 Edge。请登录 Microsoft Rewards 后关闭浏览器。" },
  "account_bot_running": { en: "Cannot add an account while a run is active.", es: "No se puede agregar una cuenta durante una ejecución.", pt: "Não é possível adicionar uma conta durante uma execução.", zh: "运行期间无法添加账户。" },
  "account_setup_failed": { en: "Setup cancelled — account was not created.", es: "Configuración cancelada: no se creó la cuenta.", pt: "Configuração cancelada — a conta não foi criada.", zh: "设置已取消，未创建账户。" },
  "account_created": { en: "Account \"{name}\" is ready.", es: "La cuenta \"{name}\" está lista.", pt: "A conta \"{name}\" está pronta.", zh: "账户“{name}”已就绪。" },
  "settings_load_error": { en: "Could not load settings.", es: "No se pudo cargar la configuración.", pt: "Não foi possível carregar as configurações.", zh: "无法加载设置。" },
  "schedule_pc_range": { en: "PC queries must be between 0 and 130.", es: "Las búsquedas de PC deben estar entre 0 y 130.", pt: "As pesquisas no PC devem estar entre 0 e 130.", zh: "电脑搜索次数必须在 0 到 130 之间。" },
  "schedule_mobile_range": { en: "Mobile queries must be between 0 and 99.", es: "Las búsquedas móviles deben estar entre 0 y 99.", pt: "As pesquisas móveis devem estar entre 0 e 99.", zh: "手机搜索次数必须在 0 到 99 之间。" },
  "schedule_choose_queries": { en: "Set at least one of PC or Mobile queries above 0.", es: "Configura al menos PC o Móvil por encima de 0.", pt: "Defina pelo menos PC ou Celular acima de 0.", zh: "请将电脑或手机搜索次数至少设为 1。" },
  "schedule_time_invalid": { en: "Daily run time must be a valid HH:MM value.", es: "La hora diaria debe tener formato HH:MM válido.", pt: "O horário diário deve estar no formato HH:MM.", zh: "每日运行时间必须为有效的 HH:MM 格式。" },
  "schedule_duration_range": { en: "Run duration must be between 1 and 24 hours.", es: "La duración debe estar entre 1 y 24 horas.", pt: "A duração deve estar entre 1 e 24 horas.", zh: "运行时长必须在 1 到 24 小时之间。" },
  "schedule_qph_range": { en: "Queries per hour must be between 1 and 99.", es: "Las búsquedas por hora deben estar entre 1 y 99.", pt: "As pesquisas por hora devem estar entre 1 e 99.", zh: "每小时搜索次数必须在 1 到 99 之间。" },
  "schedules_saved": { en: "Schedules saved.", es: "Horarios guardados.", pt: "Agendamentos salvos.", zh: "计划已保存。" },
  "schedules_failed": { en: "{count} schedule(s) failed to save.", es: "No se pudieron guardar {count} horario(s).", pt: "Falha ao salvar {count} agendamento(s).", zh: "{count} 个计划保存失败。" },
  "settings_saved_startup_failed": { en: "Settings saved, but OS startup registration failed.", es: "Configuración guardada, pero falló el registro de inicio automático.", pt: "Configurações salvas, mas o registro de inicialização falhou.", zh: "设置已保存，但系统自启注册失败。" },
  "activity_log_empty": { en: "Activity log is empty.", es: "El registro de actividad está vacío.", pt: "O registro de atividade está vazio.", zh: "活动记录为空。" },
  "activity_log_copied": { en: "Activity log copied.", es: "Registro de actividad copiado.", pt: "Registro de atividade copiado.", zh: "活动记录已复制。" },
  "activity_copy_failed": { en: "Could not copy the activity log.", es: "No se pudo copiar el registro de actividad.", pt: "Não foi possível copiar o registro de atividade.", zh: "无法复制活动记录。" },
  "checkin_sent": { en: "Check-in sent to phone.", es: "Check-in enviado al celular.", pt: "Check-in enviado ao celular.", zh: "签到请求已发送到手机。" },
  "news_sent": { en: "News task sent to phone.", es: "Tarea de noticias enviada al celular.", pt: "Tarefa de notícias enviada ao celular.", zh: "新闻任务已发送到手机。" },
  "claim": { en: "Claim", es: "Reclamar", pt: "Resgatar", zh: "领取" },
  "claim_sent": { en: "Claim task sent to phone.", es: "Solicitud de reclamo enviada al celular.", pt: "Solicitação de resgate enviada ao celular.", zh: "领取请求已发送到手机。" },
  "phone_all_sent": { en: "All mobile tasks sent to phone.", es: "Todas las tareas móviles enviadas al celular.", pt: "Todas as tarefas móveis enviadas ao celular.", zh: "所有手机任务已发送。" },
  "phone_unlinked": { en: "Phone unlinked.", es: "Celular desvinculado.", pt: "Celular desvinculado.", zh: "手机已取消关联。" },
  "runtime.ok_prefix": { en: "OK", es: "Correcto", pt: "OK", zh: "成功" },
  "runtime.skipped_prefix": { en: "Skipped", es: "Omitido", pt: "Ignorado", zh: "已跳过" },
  "runtime.error_prefix": { en: "Error", es: "Error", pt: "Erro", zh: "错误" },
  "runtime.warning_prefix": { en: "Warning", es: "Aviso", pt: "Aviso", zh: "警告" },
  "runtime.opening_edge": { en: "Opening Edge", es: "Abriendo Edge", pt: "Abrindo o Edge", zh: "正在打开 Edge" },
  "runtime.edge_ready": { en: "Edge is ready.", es: "Edge está listo.", pt: "O Edge está pronto.", zh: "Edge 已就绪。" },
  "runtime.already_complete": { en: "already complete today, skipping.", es: "ya completado hoy, omitiendo.", pt: "já concluído hoje, ignorando.", zh: "今日已完成，跳过。" },
  "runtime.not_listed": { en: "not listed on today's dashboard, skipping.", es: "no disponible hoy en el panel, omitiendo.", pt: "não disponível hoje no painel, ignorando.", zh: "今日面板未列出，跳过。" },
  "runtime.not_complete_running": { en: "not complete, running.", es: "pendiente, ejecutando.", pt: "pendente, executando.", zh: "未完成，正在运行。" },
  "runtime.credited": { en: "credited", es: "acreditado", pt: "creditado", zh: "已计分" },
  "runtime.already_done": { en: "already done", es: "ya completado", pt: "já concluído", zh: "已完成" },
  "runtime.no_phone": { en: "No linked phone available for check-in/news; continuing with the simulated mobile client.", es: "No hay celular vinculado para check-in/noticias; continuando con simulación móvil.", pt: "Nenhum celular vinculado para check-in/notícias; continuando com simulação móvel.", zh: "未关联手机进行签到/新闻；继续使用模拟移动客户端。" },
  "runtime.nothing_to_do": { en: "Nothing to do (PC and Mobile counts are both 0).", es: "Nada que ejecutar (PC y Móvil están en 0).", pt: "Nada para executar (PC e Celular estão em 0).", zh: "无任务可执行（电脑和手机次数均为 0）。" },
  "update_original_newer": { en: "A new version of the upstream repository ({tag}) is available. Notify the developer; it will not be installed automatically.", es: "Hay una nueva versión del repositorio original ({tag}). Notifica al desarrollador; no se instala automáticamente.", pt: "Há uma nova versão do repositório original ({tag}). Notifique o desenvolvedor.", zh: "上游仓库有新版本（{tag}）。请通知开发者，不会自动安装。" },
  "update_original_also": { en: "There is also an upstream repository update to notify the developer about.", es: "También hay una actualización del repositorio original.", pt: "Há também uma atualização do repositório original.", zh: "同时存在上游仓库更新。" },
  "update_custom_available": { en: "New AutoRewarder update {tag} available. Download now?", es: "Nueva actualización de AutoRewarder ({tag}) disponible. ¿Descargar ahora?", pt: "Nova atualização do AutoRewarder ({tag}) disponível. Baixar agora?", zh: "发现 AutoRewarder 新版本（{tag}）。是否立即下载？" },
  "accounts.empty_modal": { en: "No accounts yet. Click “Add account” to create your first one.", es: "Aún no hay cuentas. Pulsa «Agregar cuenta» para crear la primera.", pt: "Ainda não há contas. Clique em “Adicionar conta” para criar a primeira.", zh: "暂无账户。点击“添加账户”创建第一个账户。" },
  "account.rename_title": { en: "Rename account", es: "Renombrar cuenta", pt: "Renomear conta", zh: "重命名账户" },
  "account.delete_msg": { en: "This removes its browser profile, history, and daily-set status. This cannot be undone.", es: "Se eliminará su perfil de navegador, historial y progreso diario. Esta acción no se puede deshacer.", pt: "Isso remove o perfil do navegador, histórico e progresso diário. Não pode ser desfeito.", zh: "这将删除其浏览器配置文件、历史记录和每日任务状态，且无法撤销。" },
  "account_rename_failed": { en: "Could not rename account.", es: "No se pudo renombrar la cuenta.", pt: "Não foi possível renomear a conta.", zh: "无法重命名账户。" },
  "account_renamed": { en: "Renamed to \"{name}\".", es: "Renombrada a \"{name}\".", pt: "Renomeada para \"{name}\".", zh: "已重命名为“{name}”。" },
  "account_setup_failed_start": { en: "Setup could not be started.", es: "No se pudo iniciar la configuración.", pt: "Não foi possível iniciar a configuração.", zh: "无法启动设置。" },
  "account_delete_failed": { en: "Delete failed.", es: "No se pudo eliminar la cuenta.", pt: "Falha ao excluir a conta.", zh: "删除失败。" },
  "account_deleted_named": { en: "\"{name}\" deleted.", es: "Cuenta \"{name}\" eliminada.", pt: "Conta \"{name}\" excluída.", zh: "已删除“{name}”。" },
  "phone.setup_pending": { en: "Setup pending", es: "Configuración pendiente", pt: "Configuração pendente", zh: "待设置" },
  "gold_member": { en: "Gold Member", es: "Miembro Oro", pt: "Membro Ouro", zh: "黄金会员" },
  "silver_member": { en: "Silver Member", es: "Miembro Plata", pt: "Membro Prata", zh: "白银会员" },
  "bronze_member": { en: "Bronze Member", es: "Miembro Bronce", pt: "Membro Bronze", zh: "青铜会员" },
  "pts_per_day": { en: "pts/day", es: "pts/día", pt: "pts/dia", zh: "积分/天" },
  "recent_activity_verified": { en: "Recent activity (verified points / day)", es: "Actividad reciente (puntos verificados / día)", pt: "Atividade recente (pontos verificados / dia)", zh: "近期活动（每日已验证积分）" },
  "stats.reset_btn": { en: "Reset chart / stats", es: "Reiniciar gráfico / stats", pt: "Redefinir gráfico / stats", zh: "重置图表 / 统计" },
  "stats.reset_title": { en: "Reset statistics", es: "Reiniciar estadísticas", pt: "Redefinir estatísticas", zh: "重置统计数据" },
  "stats.reset_desc": { en: "Choose which statistics or chart data you want to reset for this account:", es: "Elige qué estadísticas o datos del gráfico deseas reiniciar en esta cuenta:", pt: "Escolha quais estatísticas ou dados do gráfico deseja redefinir nesta conta:", zh: "选择要为此账户重置的统计或图表数据：" },
  "stats.reset_scope_chart": { en: "Reset chart history (keep real balance)", es: "Reiniciar historial del gráfico (conservar saldo real)", pt: "Redefinir histórico do gráfico (manter saldo real)", zh: "重置图表历史记录（保留真实积分余额）" },
  "stats.reset_scope_today": { en: "Reset today's earned points to 0", es: "Reiniciar los puntos ganados hoy a 0", pt: "Redefinir pontos ganhos hoje para 0", zh: "将今日获得的积分重置为 0" },
  "stats.reset_scope_lifetime": { en: "Reset lifetime activity counters", es: "Reiniciar contadores históricos de actividad", pt: "Redefinir contadores históricos de atividade", zh: "重置累计活动计数器" },
  "stats.reset_scope_all": { en: "Reset all statistics & chart", es: "Reiniciar todas las estadísticas y el gráfico", pt: "Redefinir todas as estatísticas e o gráfico", zh: "重置所有统计数据和图表" },
  "stats.reset_confirm": { en: "Reset now", es: "Reiniciar ahora", pt: "Redefinir agora", zh: "立即重置" },
  "runtime.browser_hidden_on": { en: "Browser hidden mode: ON", es: "Modo navegador oculto: ACTIVADO", pt: "Modo navegador oculto: ATIVADO", zh: "隐藏浏览器模式：已开启" },
  "runtime.browser_hidden_off": { en: "Browser hidden mode: OFF", es: "Modo navegador oculto: DESACTIVADO", pt: "Modo navegador oculto: DESATIVADO", zh: "隐藏浏览器模式：已关闭" },
  "runtime.quest_detect_failed": { en: "Automatic quest detection failed", es: "Falló la detección automática de misiones", pt: "Falha na detecção automática de missões", zh: "自动检测任务失败" },
  "runtime.webdriver_error": { en: "Error loading WebDriver", es: "Error al cargar WebDriver", pt: "Erro ao carregar o WebDriver", zh: "加载 WebDriver 出错" },
  "runtime.refreshing_balance": { en: "Refreshing points balance…", es: "Actualizando saldo de puntos…", pt: "Atualizando saldo de pontos…", zh: "正在刷新积分余额…" },
  "runtime.balance_updated": { en: "Points balance updated", es: "Saldo de puntos actualizado", pt: "Saldo de pontos atualizado", zh: "积分余额已更新" },
  "runtime.switched_account": { en: "Switched to account", es: "Cuenta activa cambiada a", pt: "Conta alterada para", zh: "已切换到账户" },
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
};

Object.keys(UI_COPY).forEach(function (key) {
  ["en", "es", "pt", "zh"].forEach(function (locale) {
    I18N[locale][key] = UI_COPY[key][locale];
  });
});

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

function translate_runtime_text(value) {
  let text = String(value == null ? "" : value);
  if (!text.trim()) return text;
  const exact = tr(text);
  if (exact !== text) return exact;

  if (_uiLang === "en") {
    const enReplacements = [
      [/^Ya se está vinculando…$/i, "Already linking…"],
      [/^La cámara ya está abierta\.$/i, "Camera is already open."],
      [/^Abriendo la cámara…$/i, "Opening camera…"],
      [/^La cámara solo está en la app Android\.$/i, "Camera is only available in the Android app."],
      [/^Cámara cerrada\. Escribe el código o vuelve a escanear\.$/i, "Camera closed. Enter the code or scan again."],
      [/^QR leído\. Vinculando…$/i, "QR scanned. Linking…"],
      [/^Código leído\. Buscando el PC…$/i, "Code read. Looking for the PC…"],
      [/^Pon el código de 6 dígitos del PC\.$/i, "Enter the 6-digit code from the PC."],
      [/^Buscando el PC…$/i, "Looking for the PC…"],
      [/^Vinculando…$/i, "Linking…"],
      [/^PC encontrado\. Confirma el código y vincula\.$/i, "PC found. Confirm the code and link."],
      [/^PC encontrado\. Escribe el código y pulsa Vincular\.$/i, "PC found. Enter the code and tap Link."],
      [/^Sin conexión al PC\. Reintentando sin bloquear la aplicación…$/i, "PC offline. Retrying in background…"],
      [/^Sesión de Rewards lista en esta app\.$/i, "Rewards session ready in this app."],
      [/^Comprobando la sesión de Rewards…$/i, "Checking Rewards session…"],
      [/^Verificando en Rewards…$/i, "Verifying in Rewards…"],
      [/^Abriendo el inicio de sesión de Rewards…$/i, "Opening Rewards sign-in…"],
      [/^Inicia sesión con la cuenta Microsoft\. La sesión queda en esta app\.$/i, "Sign in with your Microsoft account. The session stays saved in this app."],
    ];
    enReplacements.forEach(function (pair) { text = text.replace(pair[0], pair[1]); });
    return text;
  }

  const replacements = [
    [/^OK\s*[—-]/i, t("runtime.ok_prefix") + " —"],
    [/^Skipped\s*[—-]/i, t("runtime.skipped_prefix") + " —"],
    [/^\[ERROR\]\s*/i, t("runtime.error_prefix") + ": "],
    [/^\[WARNING\]\s*/i, t("runtime.warning_prefix") + ": "],
    [/^\[INFO\]\s*/i, ""],
    [/^===\s*Start run\s*\(([^)]+)\)\s*===$/i, _uiLang === "zh" ? "=== 开始运行 ($1) ===" : (_uiLang === "pt" ? "=== Iniciar execução ($1) ===" : "=== Iniciando ejecución ($1) ===")],
    [/^===\s*Tasks only\s*\(([^)]+)\)\s*===$/i, _uiLang === "zh" ? "=== 仅执行任务 ($1) ===" : (_uiLang === "pt" ? "=== Somente tarefas ($1) ===" : "=== Solo tareas ($1) ===")],
    [/^Starting remaining daily tasks only…$/i, _uiLang === "zh" ? "正在仅运行剩余每日任务…" : (_uiLang === "pt" ? "Iniciando apenas tarefas diárias pendentes…" : "Iniciando solo las tareas diarias pendientes…")],
    [/^Loaded\s+(\d+)\s+queries\.\s*Starting searches\.\.\.$/i, _uiLang === "zh" ? "已加载 $1 条搜索词，开始搜索…" : (_uiLang === "pt" ? "$1 pesquisas carregadas. Iniciando buscas…" : "Se cargaron $1 consultas. Iniciando búsquedas…")],
    [/^Next coffee break after\s+(\d+)\s+searches\.$/i, _uiLang === "zh" ? "将在 $1 次搜索后暂停休息。" : (_uiLang === "pt" ? "Próxima pausa após $1 pesquisas." : "Próxima pausa después de $1 búsquedas.")],
    [/^Search\s+#(\d+):\s*(.+)$/i, _uiLang === "zh" ? "搜索 #$1：$2" : (_uiLang === "pt" ? "Pesquisa #$1: $2" : "Búsqueda #$1: $2")],
    [/^Chosen behavior:\s*Switch to\s+(.+)$/i, _uiLang === "zh" ? "随机行为：切换到 $1" : (_uiLang === "pt" ? "Ação escolhida: alternar para $1" : "Comportamiento elegido: cambiar a $1")],
    [/^Taking a quick coffee break\.\.\.$/i, _uiLang === "zh" ? "正在进行短暂休息…" : (_uiLang === "pt" ? "Fazendo uma pausa rápida…" : "Tomando una pausa breve…")],
    [/^Taking a big coffee break\.\.\.$/i, _uiLang === "zh" ? "正在进行较长休息…" : (_uiLang === "pt" ? "Fazendo uma pausa longa…" : "Tomando una pausa larga…")],
    [/^Sleeping for\s+([\d.]+)\s+seconds to mimic a coffee break\.$/i, _uiLang === "zh" ? "暂停 $1 秒以模拟真人操作。" : (_uiLang === "pt" ? "Aguardando $1 segundos para simular uma pausa humana." : "Pausando $1 segundos para simular comportamiento humano.")],
    [/^Stop requested\s*[—-]\s*halting search loop\.$/i, _uiLang === "zh" ? "已请求停止 — 正在中止搜索。" : (_uiLang === "pt" ? "Parada solicitada — interrompendo pesquisas." : "Detención solicitada — deteniendo búsquedas.")],
    [/^Done!$/i, _uiLang === "zh" ? "完成！" : (_uiLang === "pt" ? "Concluído!" : "¡Completado!")],
    [/^Stopped\.$/i, _uiLang === "zh" ? "已停止。" : (_uiLang === "pt" ? "Parado." : "Detenido.")],
    [/^Linked to\s+(.+)$/i, _uiLang === "zh" ? "已关联到 $1" : (_uiLang === "pt" ? "Vinculado a $1" : "Vinculado a $1")],
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
    [/\bLevel\s+(\d+)\b/gi, (_uiLang === "zh" ? "等级 $1" : (_uiLang === "pt" ? "Nível $1" : "Nivel $1"))],
    [/\bpts\/day\b/gi, t("pts_per_day")],
    [/\bOpening Edge\b/gi, t("runtime.opening_edge")],
    [/\bEdge is ready\./gi, t("runtime.edge_ready")],
    [/already complete today, skipping\./gi, t("runtime.already_complete")],
    [/not listed on today's dashboard, skipping\./gi, t("runtime.not_listed")],
    [/not complete, running\./gi, t("runtime.not_complete_running")],
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
  if (pack && pack[key]) return pack[key];
  if (UI_COPY[key]) return UI_COPY[key][_uiLang] || UI_COPY[key].en || key;
  if (I18N.en[key]) return I18N.en[key];
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
        // Only replace a leading text node if it actually contains visible text
        // (prevents injecting text into element-only containers like .history-filters)
        for (let i = 0; i < el.childNodes.length; i++) {
          const child = el.childNodes[i];
          if (child.nodeType === Node.TEXT_NODE && child.nodeValue && child.nodeValue.trim().length > 0) {
            child.nodeValue = translated + " ";
            return;
          }
        }
        if (el.hasAttribute("aria-label")) {
          el.setAttribute("aria-label", translated);
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
    if (stopLabel && !/Stopping|Parando|Deteniendo/.test(stopLabel.textContent)) stopLabel.textContent = t("run.stop");
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
  try {
    if (window.pywebview && pywebview.api && pywebview.api.get_settings) {
      pywebview.api.get_settings().then(function (s) {
        if (s) set_ui_lang(resolve_lang_from_settings(s));
      });
    }
  } catch (e) {}
});

function refresh_language_options() {
  const select = document.getElementById("uiLanguageSelect");
  if (!select) return;
  const labels = {
    auto: t("settings.language_auto"),
    es: t("settings.language_es"),
    en: t("settings.language_en"),
    pt: t("settings.language_pt"),
    zh: t("settings.language_zh"),
  };
  Array.prototype.forEach.call(select.options, function (option) {
    const key = option.getAttribute("data-language-option") || option.value;
    if (labels[key]) option.textContent = labels[key];
  });
}
