type Lang = "pt" | "en" | "es";

type I18n = Record<Lang, string>;

export interface GuideSection {
  id: string;
  icon: string;
  title: I18n;
  content: I18n;
}

export const PAGE_TITLE: I18n = {
  pt: "Guia do Usuário",
  en: "User Guide",
  es: "Guía del Usuario",
};

export const PAGE_SUBTITLE: I18n = {
  pt: "Tudo o que você precisa saber para usar o Talk With Data.",
  en: "Everything you need to know to use Talk With Data.",
  es: "Todo lo que necesitas saber para usar Talk With Data.",
};

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "getting-started",
    icon: "rocket",
    title: {
      pt: "Primeiros Passos",
      en: "Getting Started",
      es: "Primeros Pasos",
    },
    content: {
      pt: `O Talk With Data é a plataforma interna do Talk With Data para criar, visualizar e compartilhar dashboards e relatórios interativos.

• **Acesso:**Entre com seu e-mail corporativo da sua organizacao via login do Google via login do Google.
• **Quem pode usar:**Todos os colaboradores do Talk With Data com conta autorizada.
• **Página inicial:**Ao fazer login, você verá a home com abas, **Meus**(dashboards que você criou), **Compartilhados**(compartilhados com você), **Favoritos**e **Arquivados**.
• **Favoritos:**Dashboards marcados com estrela aparecem na aba **Favoritos**.
• **Recentes:**A seção de recentes mostra os dashboards acessados recentemente.
• **Busca:**Use a barra de busca para encontrar qualquer dashboard por nome ou conteúdo.
• **Filtros:**Filtre por categoria (departamento) ou pasta para encontrar o que precisa.

**Dica:**Marque seus dashboards favoritos com a estrela para encontrá-los rapidamente na aba **Favoritos**.`,
      en: `Talk With Data is the Talk With Data's internal platform for creating, viewing, and sharing interactive dashboards and reports.

• **Access:**Sign in with your organization email via Google login.
• **Who can use it:**All Talk With Data team members with an authorized account.
• **Home page:**After logging in, you'll see the home page with tabs, **Mine**(dashboards you created), **Shared**(shared with you), **Favorites**, and **Archived**.
• **Favorites:**Dashboards marked with a star appear in the **Favorites**tab.
• **Recent:**The recent section shows your recently viewed dashboards.
• **Search:**Use the search bar to find any dashboard by name or content.
• **Filters:**Filter by category or folder to find what you need.

**Tip:**Star your favorite dashboards so you can find them quickly in the **Favorites**tab.`,
      es: `Talk With Data es la plataforma interna del Talk With Data para crear, visualizar y compartir dashboards y reportes interactivos.

• **Acceso:**Inicia sesión con tu correo corporativo de tu organizacion mediante Google vía Google.
• **Quién puede usarlo:**Todos los colaboradores del Talk With Data con cuenta autorizada.
• **Página inicial:**Al iniciar sesión, verás la home con pestañas, **Míos**(dashboards que creaste), **Compartidos**(compartidos contigo), **Favoritos**y **Archivados**.
• **Favoritos:**Los dashboards marcados con estrella aparecen en la pestaña **Favoritos**.
• **Recientes:**La sección de recientes muestra los dashboards vistos recientemente.
• **Búsqueda:**Usa la barra de búsqueda para encontrar cualquier dashboard por nombre o contenido.
• **Filtros:**Filtra por categoría o carpeta para encontrar lo que necesitas.

**Consejo:**Marca tus dashboards favoritos con estrella para encontrarlos rápidamente en la pestaña **Favoritos**.`,
    },
  },
  {
    id: "home",
    icon: "home",
    title: {
      pt: "Página Inicial",
      en: "Home Page",
      es: "Página de Inicio",
    },
    content: {
      pt: `A página inicial é o ponto central da plataforma. Aqui você encontra todos os seus dashboards organizados de forma intuitiva.

• **Abas:**Alterne entre **Meus**(criados por você), **Compartilhados**(outros compartilharam com você), **Favoritos**e **Arquivados**(dashboards arquivados).
• **Favoritos:**Dashboards marcados com estrela aparecem na aba **Favoritos**, junto das demais listas principais.
• **Recentes:**Dashboards que você visualizou recentemente, com indicador de "Atualizado" quando o conteúdo mudou desde sua última visita.
• **Busca:**A barra de busca pesquisa por título e conteúdo extraído do HTML.
• **Filtro por categoria:**Chips de categoria (departamento) permitem filtrar rapidamente.
• **Filtro por pasta:**Selecione uma pasta pessoal para ver apenas os dashboards organizados nela.
• **Criar novo:**O botão no canto superior oferece três opções, **Upload de arquivo**, **Criar com IA**e **Conversar com dados**.
• **Novo usuário:**Se você ainda não tem dashboards, a página mostra um guia de como começar.

**Dica:**Combine filtros, por exemplo, selecione uma categoria E uma pasta para refinar ainda mais a visualização.`,
      en: `The home page is the central hub of the platform. Here you'll find all your dashboards organized intuitively.

• **Tabs:**Switch between **Mine**(created by you), **Shared**(shared with you), **Favorites**, and **Archived**(archived dashboards).
• **Favorites:**Dashboards you starred appear in the **Favorites**tab with the other main lists.
• **Recent:**Dashboards you recently viewed, with an "Updated" badge when content changed since your last visit.
• **Search:**The search bar searches by title and extracted HTML content.
• **Category filter:**Category chips let you filter quickly.
• **Folder filter:**Select a personal folder to see only dashboards organized in it.
• **Create new:**The button in the top corner offers three options, **Upload file**, **Create with AI**, and **Chat with data**.
• **New user:**If you don't have dashboards yet, the page shows a guide on how to get started.

**Tip:**Combine filters, for example, select a category AND a folder to further refine the view.`,
      es: `La página de inicio es el centro de la plataforma. Aquí encontrarás todos tus dashboards organizados de forma intuitiva.

• **Pestañas:**Alterna entre **Míos**(creados por ti), **Compartidos**(compartidos contigo), **Favoritos**y **Archivados**(dashboards archivados).
• **Favoritos:**Los dashboards marcados con estrella aparecen en la pestaña **Favoritos**, junto con las otras listas principales.
• **Recientes:**Dashboards que viste recientemente, con indicador de "Actualizado" cuando el contenido cambió desde tu última visita.
• **Búsqueda:**La barra de búsqueda busca por título y contenido extraído del HTML.
• **Filtro por categoría:**Chips de categoría permiten filtrar rápidamente.
• **Filtro por carpeta:**Selecciona una carpeta personal para ver solo los dashboards organizados en ella.
• **Crear nuevo:**El botón en la esquina superior ofrece tres opciones, **Subir archivo**, **Crear con IA**y **Conversar con datos**.
• **Nuevo usuario:**Si aún no tienes dashboards, la página muestra una guía de cómo empezar.

**Consejo:**Combina filtros, por ejemplo, selecciona una categoría Y una carpeta para refinar aún más la vista.`,
    },
  },
  {
    id: "uploading",
    icon: "upload",
    title: {
      pt: "Upload de Arquivo",
      en: "Uploading Dashboards",
      es: "Subir Archivo",
    },
    content: {
      pt: `Publique um HTML ou ZIP pronto diretamente na plataforma.

• **Como enviar:**Clique em **Upload de arquivo**no menu de criação da página inicial, ou acesse \`/upload\`.
• **Formatos:**Arquivo HTML único ou arquivo ZIP contendo múltiplas páginas.
• **ZIP:**Ao enviar um ZIP, você escolhe qual arquivo HTML será o ponto de entrada (página principal). Os demais arquivos ficam acessíveis como sub-páginas.
• **Campos:**Título, descrição (opcional), categoria e configuração de visibilidade.
• **Categorias:**Escolha uma categoria existente para organizar seus dashboards.
• **Visibilidade:**"Team" torna visível para todos; "Specific" permite selecionar quem pode ver.
• **Limite:**Até 10MB por arquivo.

**Dica:**Use nomes descritivos, ajuda todo mundo a encontrar seu dashboard depois.`,
      en: `Upload a ready-made HTML or ZIP file directly to the platform.

• **How to upload:**Click **Upload file**in the create menu on the home page, or go to \`/upload\`.
• **Formats:**Single HTML file or ZIP file containing multiple pages.
• **ZIP:**When uploading a ZIP, you choose which HTML file is the entrypoint (main page). Other files are accessible as sub-pages.
• **Fields:**Title, description (optional), category, and visibility settings.
• **Categories:**Choose an existing category to organize your dashboards.
• **Visibility:**"Team" makes it visible to everyone; "Specific" lets you choose who can see it.
• **Limit:**Up to 10MB per file.

**Tip:**Use descriptive names, it helps everyone find your dashboard later.`,
      es: `Publica un HTML o ZIP listo directamente en la plataforma.

• **Cómo subir:**Haz clic en **Subir archivo**en el menú de creación de la página principal, o ve a \`/upload\`.
• **Formatos:**Archivo HTML único o archivo ZIP con múltiples páginas.
• **ZIP:**Al subir un ZIP, eliges cuál archivo HTML será el punto de entrada (página principal). Los demás archivos quedan accesibles como sub-páginas.
• **Campos:**Título, descripción (opcional), categoría y configuración de visibilidad.
• **Categorías:**Elige una categoría existente para organizar tus dashboards.
• **Visibilidad:**"Team" lo hace visible para todos; "Specific" permite elegir quién puede verlo.
• **Límite:**Hasta 10MB por archivo.

**Consejo:**Usa nombres descriptivos, ayuda a todos a encontrar tu dashboard después.`,
    },
  },
  {
    id: "ai-chat",
    icon: "message-square",
    title: {
      pt: "Conversar com Dados",
      en: "AI Data Chat",
      es: "Conversar con Datos",
    },
    content: {
      pt: `O recurso Conversar com Dados permite fazer perguntas em linguagem natural sobre os dados disponiveis, e a IA responde com análises, tabelas e gráficos.

• **Como acessar:**Clique em **Conversar com dados**no menu de criação da página inicial, ou acesse \`/chat\`.
• **Pré-requisito:**Você precisa ter acesso a pelo menos uma fonte de dados (MCP). Se a opção não aparecer, solicite acesso ao administrador.
• **O que perguntar:**Qualquer coisa sobre os dados disponíveis, membros, eventos, receita, engajamento, etc.
• **Sessões:**Suas conversas ficam salvas em sessões. Você pode criar novas sessões, renomeá-las e retomar conversas anteriores pela barra lateral.
• **MCPs (Model Context Protocol):**São as fontes de dados que a IA consulta. A plataforma conecta automaticamente aos bancos de dados autorizados para o seu perfil.
• **Respostas:**A IA pode gerar tabelas, gráficos e insights a partir das suas perguntas.

**Dica:**Seja específico nas perguntas. "Quantos membros novos entraram em março?" funciona melhor que "me fale sobre membros".`,
      en: `The Chat with Data feature lets you ask questions in natural language about available data, and the AI responds with analyses, tables, and charts.

• **How to access:**Click **Chat with data**in the create menu on the home page, or go to \`/chat\`.
• **Prerequisite:**You need access to at least one data source (MCP). If the option doesn't appear, request access from your admin.
• **What to ask:**Anything about available data, members, events, revenue, engagement, etc.
• **Sessions:**Your conversations are saved in sessions. You can create new sessions, rename them, and resume previous conversations from the sidebar.
• **MCPs (Model Context Protocol):**These are the data sources the AI queries. The platform automatically connects to databases authorized for your profile.
• **Responses:**The AI can generate tables, charts, and insights from your questions.

**Tip:**Be specific in your questions. "How many new members joined in March?" works better than "tell me about members".`,
      es: `La función Conversar con Datos permite hacer preguntas en lenguaje natural sobre los datos disponibles, y la IA responde con análisis, tablas y gráficos.

• **Cómo acceder:**Haz clic en **Conversar con datos**en el menú de creación de la página principal, o ve a \`/chat\`.
• **Prerrequisito:**Necesitas acceso a al menos una fuente de datos (MCP). Si la opción no aparece, solicita acceso a tu administrador.
• **Qué preguntar:**Cualquier cosa sobre los datos disponibles, miembros, eventos, ingresos, engagement, etc.
• **Sesiones:**Tus conversaciones se guardan en sesiones. Puedes crear nuevas sesiones, renombrarlas y retomar conversaciones anteriores desde la barra lateral.
• **MCPs (Model Context Protocol):**Son las fuentes de datos que la IA consulta. La plataforma se conecta automáticamente a las bases de datos autorizadas para tu perfil.
• **Respuestas:**La IA puede generar tablas, gráficos e insights a partir de tus preguntas.

**Consejo:**Sé específico en tus preguntas. "¿Cuántos miembros nuevos ingresaron en marzo?" funciona mejor que "háblame de miembros".`,
    },
  },
  {
    id: "creating",
    icon: "sparkles",
    title: {
      pt: "Criar com IA",
      en: "Create with AI",
      es: "Crear con IA",
    },
    content: {
      pt: `A IA pode criar dashboards completos a partir de uma descrição em texto. Você descreve o que quer e ela gera o HTML interativo com dados reais.

• **Como acessar:**Clique em **Criar com IA**no menu de criação da página inicial, ou acesse \`/create\`.
• **Pré-requisito:**Requer acesso MCP, você precisa ter pelo menos uma fonte de dados atribuída ao seu perfil. Sem isso, a opção não aparece. Solicite ao administrador.
• **Fluxo:**Descreva o dashboard que precisa, a IA consulta os dados via MCP, gera um dashboard HTML interativo, você pode refinar com instruções adicionais.
• **Fontes de dados:**A IA tem acesso aos mesmos dados do Chat, consulta bancos autorizados e cria visualizações automaticamente.
• **Resultado:**Um dashboard HTML interativo salvo na plataforma, pronto para visualizar e compartilhar.

**Dica:**Comece com uma descrição clara do objetivo. Exemplo: "Dashboard mostrando receita mensal por região nos últimos 12 meses".`,
      en: `The AI can create complete dashboards from a text description. Describe what you need and it generates interactive HTML with real data.

• **How to access:**Click **Create with AI**in the create menu on the home page, or go to \`/create\`.
• **Prerequisite:**Requires MCP access, you need at least one data source assigned to your profile. Without it, the option won't appear. Request it from your admin.
• **Flow:**Describe the dashboard you need, the AI queries data via MCP, generates an interactive HTML dashboard, you can refine with additional instructions.
• **Data sources:**The AI has access to the same data as Chat, it queries authorized databases and creates visualizations automatically.
• **Result:**An interactive HTML dashboard saved to the platform, ready to view and share.

**Tip:**Start with a clear goal description. Example: "Dashboard showing monthly revenue by region for the last 12 months".`,
      es: `La IA puede crear dashboards completos a partir de una descripción en texto. Describe lo que necesitas y genera HTML interactivo con datos reales.

• **Cómo acceder:**Haz clic en **Crear con IA**en el menú de creación de la página principal, o ve a \`/create\`.
• **Prerrequisito:**Requiere acceso MCP, necesitas al menos una fuente de datos asignada a tu perfil. Sin eso, la opción no aparece. Solicítalo a tu administrador.
• **Flujo:**Describe el dashboard que necesitas, la IA consulta datos vía MCP, genera un dashboard HTML interactivo, puedes refinar con instrucciones adicionales.
• **Fuentes de datos:**La IA tiene acceso a los mismos datos del Chat, consulta bases autorizadas y crea visualizaciones automáticamente.
• **Resultado:**Un dashboard HTML interactivo guardado en la plataforma, listo para ver y compartir.

**Consejo:**Empieza con una descripción clara del objetivo. Ejemplo: "Dashboard mostrando ingresos mensuales por región en los últimos 12 meses".`,
    },
  },
  {
    id: "editing",
    icon: "pencil",
    title: {
      pt: "Editando Dashboards",
      en: "Editing Dashboards",
      es: "Editando Dashboards",
    },
    content: {
      pt: `Dashboards criados pela IA podem ser editados e refinados a qualquer momento.

• **Botão Editar:**Na página de visualização do dashboard, clique no botão **Editar**para reabrir o editor com IA e o contexto do dashboard atual.
• **Menu ⋮:**Você também pode acessar a edição pelo menu ⋮ do card do dashboard na página inicial.
• **O que mudar:**Peça alterações em linguagem natural, "adicione um filtro por país", "mude as cores para azul", "inclua dados de 2024".
• **Atualizar dados:**Use o botão **Atualizar**para re-consultar os dados ao vivo e regenerar o dashboard com números atualizados, sem precisar descrever tudo de novo.
• **Versões:**Cada edição cria uma nova versão. A versão anterior fica salva no histórico.

**Dica:**A edição com IA está disponível apenas para dashboards criados pela IA (\`source: ai\`). Dashboards enviados por upload podem ser substituídos com um novo arquivo.`,
      en: `AI-created dashboards can be edited and refined at any time.

• **Edit button:**On the dashboard view page, click the **Edit**button to reopen the AI editor with the current dashboard context.
• **⋮ menu:**You can also access editing from the ⋮ menu on the dashboard card on the home page.
• **What to change:**Request changes in natural language, "add a filter by country", "change colors to blue", "include 2024 data".
• **Refresh data:**Use the **Refresh**button to re-query live data and regenerate the dashboard with updated numbers, without re-describing everything.
• **Versions:**Each edit creates a new version. The previous version is saved in the history.

**Tip:**AI editing is available only for AI-created dashboards (\`source: ai\`). Uploaded dashboards can be replaced with a new file.`,
      es: `Los dashboards creados por IA pueden editarse y refinarse en cualquier momento.

• **Botón Editar:**En la página de visualización del dashboard, haz clic en el botón **Editar**para reabrir el editor con IA y el contexto actual.
• **Menú ⋮:**También puedes acceder a la edición desde el menú ⋮ en la tarjeta del dashboard en la página principal.
• **Qué cambiar:**Pide cambios en lenguaje natural, "agrega un filtro por país", "cambia los colores a azul", "incluye datos de 2024".
• **Actualizar datos:**Usa el botón **Actualizar**para re-consultar los datos en vivo y regenerar el dashboard con números actualizados, sin necesidad de describir todo de nuevo.
• **Versiones:**Cada edición crea una nueva versión. La versión anterior queda guardada en el historial.

**Consejo:**La edición con IA está disponible solo para dashboards creados por IA (\`source: ai\`). Los dashboards subidos pueden reemplazarse con un nuevo archivo.`,
    },
  },
  {
    id: "exploring",
    icon: "database",
    title: {
      pt: "Explorar Dados",
      en: "Exploring Data",
      es: "Explorar Datos",
    },
    content: {
      pt: `A página Explorar Dados permite descobrir quais fontes de dados estão disponíveis para você na plataforma.

• **Como acessar:**Clique em **Explorar dados**no cabeçalho ou acesse \`/explore\`.
• **Pré-requisito:**Disponível apenas para usuários com acesso a pelo menos uma fonte de dados (MCP). Se o link não aparecer no cabeçalho, solicite acesso ao administrador.
• **O que ver:**Lista de todas as fontes de dados (MCPs) conectadas ao seu perfil, incluindo as ferramentas (queries) disponíveis em cada uma.
• **Utilidade:**Entenda quais dados existem antes de perguntar no Chat ou criar um dashboard com IA.

**Dica:**Use o Explorar para descobrir os nomes exatos das ferramentas e dados, isso torna suas perguntas no Chat mais precisas.`,
      en: `The Explore Data page lets you discover what data sources are available to you on the platform.

• **How to access:**Click **Explore data**in the header or go to \`/explore\`.
• **Prerequisite:**Available only for users with access to at least one data source (MCP). If the link doesn't appear in the header, request access from your admin.
• **What to see:**A list of all data sources (MCPs) connected to your profile, including the tools (queries) available in each one.
• **Use case:**Understand what data exists before asking in Chat or creating a dashboard with AI.

**Tip:**Use Explore to find the exact names of tools and data, it makes your Chat questions more precise.`,
      es: `La página Explorar Datos permite descubrir qué fuentes de datos están disponibles para ti en la plataforma.

• **Cómo acceder:**Haz clic en **Explorar datos**en el encabezado o ve a \`/explore\`.
• **Prerrequisito:**Disponible solo para usuarios con acceso a al menos una fuente de datos (MCP). Si el link no aparece en el encabezado, solicita acceso a tu administrador.
• **Qué ver:**Lista de todas las fuentes de datos (MCPs) conectadas a tu perfil, incluyendo las herramientas (queries) disponibles en cada una.
• **Utilidad:**Entiende qué datos existen antes de preguntar en el Chat o crear un dashboard con IA.

**Consejo:**Usa Explorar para descubrir los nombres exactos de herramientas y datos, eso hace tus preguntas en el Chat más precisas.`,
    },
  },
  {
    id: "multipage",
    icon: "layers",
    title: {
      pt: "Dashboards Multi-página",
      en: "Multi-page Dashboards",
      es: "Dashboards Multi-página",
    },
    content: {
      pt: `Dashboards complexos com múltiplas páginas podem ser enviados como arquivo ZIP.

• **Upload:**Envie um arquivo ZIP contendo seus HTMLs, CSS, JS, imagens e outros assets.
• **Ponto de entrada:**Após o upload, escolha qual arquivo HTML será a página principal do dashboard.
• **Navegação:**Links internos entre páginas funcionam automaticamente. A plataforma resolve os caminhos relativos dentro do ZIP.
• **Assets:**CSS, JavaScript, imagens e outros recursos incluídos no ZIP são servidos corretamente via rotas de sub-recurso.
• **Autenticação:**Um cookie de sessão é gerado para autenticar o acesso a todas as sub-páginas e recursos do mesmo dashboard, incluindo em embeds.
• **Substituição:**Você pode substituir o ZIP inteiro fazendo upload de uma nova versão.

**Dica:**Certifique-se de que os links internos usam caminhos relativos (ex: \`./pagina2.html\`) para que a navegação funcione corretamente.`,
      en: `Complex dashboards with multiple pages can be uploaded as ZIP files.

• **Upload:**Send a ZIP file containing your HTMLs, CSS, JS, images, and other assets.
• **Entrypoint:**After upload, choose which HTML file will be the main page of the dashboard.
• **Navigation:**Internal links between pages work automatically. The platform resolves relative paths within the ZIP.
• **Assets:**CSS, JavaScript, images, and other resources included in the ZIP are served correctly via sub-resource routes.
• **Authentication:**A session cookie is generated to authenticate access to all sub-pages and resources of the same dashboard, including in embeds.
• **Replacement:**You can replace the entire ZIP by uploading a new version.

**Tip:**Make sure internal links use relative paths (e.g., \`./page2.html\`) so navigation works correctly.`,
      es: `Dashboards complejos con múltiples páginas pueden enviarse como archivo ZIP.

• **Upload:**Envía un archivo ZIP con tus HTMLs, CSS, JS, imágenes y otros assets.
• **Punto de entrada:**Después del upload, elige cuál archivo HTML será la página principal del dashboard.
• **Navegación:**Los links internos entre páginas funcionan automáticamente. La plataforma resuelve las rutas relativas dentro del ZIP.
• **Assets:**CSS, JavaScript, imágenes y otros recursos incluidos en el ZIP se sirven correctamente vía rutas de sub-recurso.
• **Autenticación:**Se genera un cookie de sesión para autenticar el acceso a todas las sub-páginas y recursos del mismo dashboard, incluyendo embeds.
• **Reemplazo:**Puedes reemplazar el ZIP completo subiendo una nueva versión.

**Consejo:**Asegúrate de que los links internos usen rutas relativas (ej: \`./pagina2.html\`) para que la navegación funcione correctamente.`,
    },
  },
  {
    id: "fields",
    icon: "settings",
    title: {
      pt: "Campos do Dashboard",
      en: "Dashboard Fields",
      es: "Campos del Dashboard",
    },
    content: {
      pt: `Campos persistentes permitem adicionar metadados estruturados a qualquer dashboard, como responsável, data de atualização, status, links, etc.

• **Quem pode usar:**Apenas o **dono do dashboard**(quem criou ou fez upload) pode definir campos e editar valores. Outros usuários não vîem os controles de edição.
• **Definir campos:**Na página de visualização, clique no ícone de engrenagem para abrir o construtor de esquema. Defina os campos que o dashboard precisa.
• **Tipos disponíveis:**Texto, Número, Data, Seleção (dropdown), Seleção múltipla, URL e Booleano.
• **Opções:**Campos do tipo Seleção e Seleção múltipla permitem definir as opções disponíveis.
• **Obrigatório:**Marque campos como obrigatórios para garantir preenchimento.
• **Edição inline:**Na barra lateral da página de visualização, edite os valores dos campos diretamente. As alterações são salvas automaticamente.
• **Auditoria:**Todas as alterações de valores são registradas com quem mudou e quando.
• **Ordenação:**Arraste os campos no construtor de esquema para definir a ordem de exibição.

**Dica:**Use campos para rastrear informações que mudam ao longo do tempo, por exemplo, "Última atualização", "Responsável" ou "Status da revisão".`,
      en: `Persistent fields let you add structured metadata to any dashboard, like owner, update date, status, links, etc.

• **Who can use this:**Only the **dashboard owner**(the person who created or uploaded it) can define fields and edit values. Other users don't see the editing controls.
• **Define fields:**On the view page, click the gear icon to open the schema builder. Define the fields the dashboard needs.
• **Available types:**Text, Number, Date, Select (dropdown), Multi-select, URL, and Boolean.
• **Options:**Select and Multi-select fields let you define the available options.
• **Required:**Mark fields as required to ensure they're filled in.
• **Inline editing:**In the sidebar on the view page, edit field values directly. Changes are saved automatically.
• **Audit:**All value changes are logged with who changed them and when.
• **Ordering:**Drag fields in the schema builder to set the display order.

**Tip:**Use fields to track information that changes over time, for example, "Last updated", "Owner", or "Review status".`,
      es: `Los campos persistentes permiten agregar metadatos estructurados a cualquier dashboard, como responsable, fecha de actualización, estado, links, etc.

• **Quién puede usarlo:**Solo el **dueño del dashboard**(quien lo creó o subió) puede definir campos y editar valores. Otros usuarios no ven los controles de edición.
• **Definir campos:**En la página de visualización, haz clic en el ícono de engranaje para abrir el constructor de esquema. Define los campos que el dashboard necesita.
• **Tipos disponibles:**Texto, Número, Fecha, Selección (dropdown), Selección múltiple, URL y Booleano.
• **Opciones:**Campos de tipo Selección y Selección múltiple permiten definir las opciones disponibles.
• **Obligatorio:**Marca campos como obligatorios para garantizar su llenado.
• **Edición inline:**En la barra lateral de la página de visualización, edita los valores de los campos directamente. Los cambios se guardan automáticamente.
• **Auditoría:**Todos los cambios de valores se registran con quién cambió y cuándo.
• **Ordenación:**Arrastra los campos en el constructor de esquema para definir el orden de visualización.

**Consejo:**Usa campos para rastrear información que cambia con el tiempo, por ejemplo, "Última actualización", "Responsable" o "Estado de revisión".`,
    },
  },
  {
    id: "folders",
    icon: "folder",
    title: {
      pt: "Pastas e Organização",
      en: "Folders & Organization",
      es: "Carpetas y Organización",
    },
    content: {
      pt: `Organize seus dashboards em pastas pessoais e use favoritos para acesso rápido.

• **Criar pasta:**Na página inicial, clique no botão de gerenciar pastas ao lado dos filtros de pasta.
• **Adicionar à pasta:**No menu ⋮ de qualquer dashboard, selecione **Adicionar à pasta**.
• **Favoritos:**Clique na estrela no canto de qualquer dashboard para marcá-lo como favorito. Favoritos aparecem na aba **Favoritos**da home.
• **Categorias:**As categorias são definidas ao enviar o dashboard e servem como filtro global na página inicial.

**Dica:**Use pastas para organização pessoal (ex: "Meus relatórios semanais") e categorias para organização do time.`,
      en: `Organize your dashboards into personal folders and use favorites for quick access.

• **Create a folder:**On the home page, click the folder management button next to the folder filters.
• **Add to folder:**In any dashboard's ⋮ menu, select **Add to folder**.
• **Favorites:**Click the star on any dashboard's corner to mark it as a favorite. Favorites appear in the **Favorites**tab on the home page.
• **Categories:**Categories are set when uploading a dashboard and serve as global filters on the home page.

**Tip:**Use folders for personal organization (e.g., "My weekly reports") and categories for team-wide organization.`,
      es: `Organiza tus dashboards en carpetas personales y usa favoritos para acceso rápido.

• **Crear carpeta:**En la página principal, haz clic en el botón de gestión de carpetas al lado de los filtros.
• **Agregar a carpeta:**En el menú ⋮ de cualquier dashboard, selecciona **Adicionar à pasta**.
• **Favoritos:**Haz clic en la estrella en la esquina de cualquier dashboard para marcarlo como favorito. Los favoritos aparecen en la pestaña **Favoritos**de la home.
• **Categorías:**Las categorías se definen al subir el dashboard y sirven como filtro global en la página principal.

**Consejo:**Usa carpetas para organización personal (ej: "Mis reportes semanales") y categorías para organización del equipo.`,
    },
  },
  {
    id: "sharing",
    icon: "share",
    title: {
      pt: "Compartilhamento e Embed",
      en: "Sharing & Embedding",
      es: "Compartir y Embed",
    },
    content: {
      pt: `Controle quem vê seus dashboards e incorpore-os em outras plataformas.

• **Visibilidade:**Ao criar ou editar, escolha "Team" (todos) ou "Specific" (lista de e-mails).
• **Compartilhamento:**No menu ⋮, clique em **Compartilhamento**para alterar a visibilidade.
• **Link de Embed:**Qualquer usuário com acesso ao dashboard pode gerar um link de embed temporário (válido por 7 dias) pelo menu ⋮, **Copiar link de embed**.
• **Uso do embed:**Cole o link em um iframe para exibir o dashboard em outro site ou ferramenta (Notion, Slack, etc.).
• **Multi-página:**Embeds de dashboards ZIP usam cookie de sessão para autenticar sub-páginas automaticamente.

**Dica:**Links de embed expiram automaticamente após 7 dias. Gere um novo quando precisar.`,
      en: `Control who sees your dashboards and embed them in other platforms.

• **Visibility:**When creating or editing, choose "Team" (everyone) or "Specific" (email list).
• **Sharing:**In the ⋮ menu, click **Sharing**to change visibility.
• **Embed link:**Any user with access to the dashboard can generate a temporary embed link (valid for 7 days) via ⋮ menu, **Copy embed link**.
• **Using embeds:**Paste the link in an iframe to display the dashboard on another site or tool (Notion, Slack, etc.).
• **Multi-page:**Embeds of ZIP dashboards use session cookies to authenticate sub-pages automatically.

**Tip:**Embed links expire automatically after 7 days. Generate a new one when needed.`,
      es: `Controla quién ve tus dashboards e incorpóralos en otras plataformas.

• **Visibilidad:**Al crear o editar, elige "Team" (todos) o "Specific" (lista de correos).
• **Compartir:**En el menú ⋮, haz clic en **Compartilhamento**para cambiar la visibilidad.
• **Link de Embed:**Cualquier usuario con acceso al dashboard puede generar un link de embed temporal (válido por 7 días) vía menú ⋮, **Copiar link de embed**.
• **Uso del embed:**Pega el link en un iframe para mostrar el dashboard en otro sitio o herramienta (Notion, Slack, etc.).
• **Multi-página:**Los embeds de dashboards ZIP usan cookie de sesión para autenticar sub-páginas automáticamente.

**Consejo:**Los links de embed expiran automáticamente después de 7 días. Genera uno nuevo cuando lo necesites.`,
    },
  },
  {
    id: "versions",
    icon: "history",
    title: {
      pt: "Versões Anteriores",
      en: "Version History",
      es: "Versiones Anteriores",
    },
    content: {
      pt: `Cada atualização de um dashboard cria uma nova versão. Você pode visualizar e restaurar versões anteriores.

• **Como acessar:**No menu ⋮ do dashboard, clique em **Versões anteriores**.
• **Visualizar:**Veja a lista de versões com data e hora de cada uma. Clique para pré-visualizar.
• **Restaurar:**Clique em restaurar para tornar uma versão anterior a versão atual.
• **Multi-página:**A restauração de versões não está disponível para dashboards ZIP (multi-página). Para esses, faça upload de um novo ZIP.

**Dica:**As versões são criadas automaticamente ao fazer upload de um novo arquivo, editar com IA ou atualizar dados. Não é necessário salvar manualmente.`,
      en: `Each dashboard update creates a new version. You can view and restore previous versions.

• **How to access:**In the dashboard's ⋮ menu, click **Previous versions**.
• **View:**See the list of versions with date and time. Click to preview.
• **Restore:**Click restore to make a previous version the current one.
• **Multi-page:**Version restore is not available for ZIP (multi-page) dashboards. For those, upload a new ZIP.

**Tip:**Versions are created automatically when uploading a new file, editing with AI, or refreshing data. No manual saving required.`,
      es: `Cada actualización de un dashboard crea una nueva versión. Puedes ver y restaurar versiones anteriores.

• **Cómo acceder:**En el menú ⋮ del dashboard, haz clic en **Versiones anteriores**.
• **Ver:**Mira la lista de versiones con fecha y hora. Haz clic para previsualizar.
• **Restaurar:**Haz clic en restaurar para volver a una versión anterior.
• **Multi-página:**La restauración de versiones no está disponible para dashboards ZIP (multi-página). Para esos, sube un nuevo ZIP.

**Consejo:**Las versiones se crean automáticamente al subir un nuevo archivo, editar con IA o actualizar datos. No es necesario guardar manualmente.`,
    },
  },
  {
    id: "roles",
    icon: "shield",
    title: {
      pt: "Privilégios de Acesso",
      en: "Access Privileges",
      es: "Privilegios de Acceso",
    },
    content: {
      pt: `A plataforma usa três roles: \`user\`, \`admin\` e \`superadmin\`. Novos usuários recebem \`user\` por padrão, exceto quando existe pré-aprovação em \`pendingRoles\`.

• **user**, Usa a plataforma normalmente: visualiza dashboards permitidos, cria uploads, organiza favoritos/pastas, gera links de embed para dashboards aos quais tem acesso e usa **Criar com IA**, **Conversar com dados**e **Explorar dados**quando tiver MCP access.
• **admin**, Acessa o painel Admin operacional: visão geral, dashboards, usuários, métricas de acesso e armazenamento. Não altera roles e não gerencia configurações sensíveis.
• **superadmin**, Gerencia configurações sensíveis: roles de usuários, AI config, Categories, Departments, MCP Servers e MCP Access.
• **MCP access**, É independente da role. Um \`user\`, \`admin\` ou \`superadmin\` pode receber acesso a fontes de dados por usuário individual ou Department.

**Dica:**Solicite MCP access quando precisar usar IA com dados. Solicite role \`admin\` ou \`superadmin\` apenas quando houver necessidade operacional real.`,
      en: `The platform uses three roles: \`user\`, \`admin\`, and \`superadmin\`. New users receive \`user\` by default unless there is a pre-approved \`pendingRoles\` entry.

• **user**, Uses the product normally: views permitted dashboards, uploads dashboards, organizes favorites/folders, generates embed links for dashboards they can access, and uses **Create with AI**, **Chat with data**, and **Explore data**when they have MCP access.
• **admin**, Accesses the operational Admin panel: overview, dashboards, users, access metrics, and storage. Admins do not change roles and do not manage sensitive settings.
• **superadmin**, Manages sensitive settings: user roles, AI config, Categories, Departments, MCP Servers, and MCP Access.
• **MCP access**, Independent from role. A \`user\`, \`admin\`, or \`superadmin\` can receive data-source access by individual user or Department.

**Tip:**Request MCP access when you need AI with data. Request \`admin\` or \`superadmin\` only when there is a real operational need.`,
      es: `La plataforma usa tres roles: \`user\`, \`admin\` y \`superadmin\`. Los nuevos usuarios reciben \`user\` por defecto, salvo que exista una preaprobación en \`pendingRoles\`.

• **user**, Usa el producto normalmente: visualiza dashboards permitidos, sube dashboards, organiza favoritos/carpetas, genera links de embed para dashboards a los que tiene acceso y usa **Crear con IA**, **Conversar con datos**y **Explorar datos**cuando tiene MCP access.
• **admin**, Accede al panel Admin operativo: visión general, dashboards, usuarios, métricas de acceso y almacenamiento. Los admins no cambian roles ni gestionan configuraciones sensibles.
• **superadmin**, Gestiona configuraciones sensibles: roles de usuarios, AI config, Categories, Departments, MCP Servers y MCP Access.
• **MCP access**, Es independiente del role. Un \`user\`, \`admin\` o \`superadmin\` puede recibir acceso a fuentes de datos por usuario individual o Department.

**Consejo:**Solicita MCP access cuando necesites IA con datos. Solicita \`admin\` o \`superadmin\` solo cuando exista una necesidad operativa real.`,
    },
  },
  {
    id: "admin",
    icon: "shield",
    title: {
      pt: "Painel de Admin",
      en: "Admin Panel",
      es: "Panel de Admin",
    },
    content: {
      pt: `O painel de Admin é acessível para administradores e superadmins. Permite gerenciar a plataforma de forma centralizada.

• **Como acessar:**Clique no ícone **Admin**no cabeçalho (visível apenas para admins).

**Abas disponíveis:**

• **Visão Geral**, Contadores de dashboards, usuários, visualizações, armazenamento e tokens de embed.
• **Dashboards**, Tabela com todos os dashboards, ordenável por visualizações, armazenamento e categoria.
• **Usuários**, Tabela de atividade e roles. Alterações de role são exclusivas de superadmins.
• **Acesso**, Gráfico de visualizações diárias (diretas vs embed), top dashboards embeddados, lista de tokens.
• **Armazenamento**, Uso por usuário/categoria, arquivos grandes, armazenamento de versões.
• **Categorias***(superadmin)*, Gerenciar as categorias de dashboards (usadas como filtro na home).
• **Departamentos***(superadmin)*, Gerenciar departamentos organizacionais e seus membros.
• **Servidores MCP***(superadmin)*, Cadastrar e gerenciar fontes de dados MCP. Sincronizar ferramentas disponíveis.
• **Acesso MCP***(superadmin)*, Atribuir acesso a servidores MCP por departamento ou usuário individual.

**Dica:**Se você precisa de acesso admin ou superadmin, solicite a um superadmin da equipe de tecnologia com a justificativa operacional.`,
      en: `The Admin panel is accessible to administrators and superadmins. It provides centralized platform management.

• **How to access:**Click the **Admin**icon in the header (visible only to admins).

**Available tabs:**

• **Overview**, Dashboard, user, view, storage, and embed token counts.
• **Dashboards**, Table of all dashboards, sortable by views, storage, and category.
• **Users**, Activity and role table. Role changes are exclusive to superadmins.
• **Access**, Daily views chart (direct vs embed), top embedded dashboards, token list.
• **Storage**, Usage by user/category, large files, version storage.
• **Categories***(superadmin)*, Manage dashboard categories (used as filters on the home page).
• **Departments***(superadmin)*, Manage organizational departments and their members.
• **MCP Servers***(superadmin)*, Register and manage MCP data sources. Sync available tools.
• **MCP Access***(superadmin)*, Assign MCP server access by department or individual user.

**Tip:**If you need admin or superadmin access, request it from a superadmin on the tech team with the operational reason.`,
      es: `El panel de Admin es accesible para administradores y superadmins. Proporciona gestión centralizada de la plataforma.

• **Cómo acceder:**Haz clic en el ícono **Admin**en el encabezado (visible solo para admins).

**Pestañas disponibles:**

• **Visión General**, Contadores de dashboards, usuarios, visualizaciones, almacenamiento y tokens de embed.
• **Dashboards**, Tabla con todos los dashboards, ordenable por visualizaciones, almacenamiento y categoría.
• **Usuarios**, Tabla de actividad y roles. Los cambios de role son exclusivos de superadmins.
• **Acceso**, Gráfico de visualizaciones diarias (directas vs embed), top dashboards embebidos, lista de tokens.
• **Almacenamiento**, Uso por usuario/categoría, archivos grandes, almacenamiento de versiones.
• **Categorías***(superadmin)*, Gestionar las categorías de dashboards (usadas como filtro en la página principal).
• **Departamentos***(superadmin)*, Gestionar departamentos organizacionales y sus miembros.
• **Servidores MCP***(superadmin)*, Registrar y gestionar fuentes de datos MCP. Sincronizar herramientas disponibles.
• **Acceso MCP***(superadmin)*, Asignar acceso a servidores MCP por departamento o usuario individual.

**Consejo:**Si necesitas acceso admin o superadmin, solicítalo a un superadmin del equipo de tecnología con la justificación operativa.`,
    },
  },
];
