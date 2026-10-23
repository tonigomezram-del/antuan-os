// Catalogo curado de la Tienda Antuan.
// Cada app: { id, nombre, descripcion, categoria, color, icono, fuentes: { winget, flatpak, apt }, ... }
//  - icono: nombre de glifo de ui/icons.js o URL del icono 128x128 de Flathub.
//  - fuentes: SOLO las que existen de verdad. IDs de winget comprobados con `winget show --id X --exact`.
//  - opcionales: wingetFuente ('msstore'), menu (nombre del acceso del menu Inicio para "Abrir"),
//    bin (ejecutable en Linux si difiere del paquete apt), cli (herramienta sin ventana: no se "abre"),
//    enlace (web oficial cuando no hay instalador automatico), destacado (texto para la portada).
'use strict';

const FH = (id) => `https://dl.flathub.org/repo/appstream/x86_64/icons/128x128/${id}.png`;

const CATEGORIAS = [
  { id: 'navegadores', nombre: 'Navegadores', icono: 'globe' },
  { id: 'comunicacion', nombre: 'Comunicación', icono: 'chat' },
  { id: 'multimedia', nombre: 'Música y vídeo', icono: 'music' },
  { id: 'juegos', nombre: 'Juegos', icono: 'game' },
  { id: 'creatividad', nombre: 'Creatividad', icono: 'palette' },
  { id: 'desarrollo', nombre: 'Desarrollo', icono: 'code' },
  { id: 'productividad', nombre: 'Productividad', icono: 'note' },
  { id: 'utilidades', nombre: 'Utilidades', icono: 'cube' }
];

const a = (id, nombre, categoria, color, descripcion, fuentes, extra = {}) => ({
  id, nombre, categoria, color, descripcion, fuentes,
  icono: extra.icono || (fuentes.flatpak ? FH(fuentes.flatpak) : CATEGORIAS.find((c) => c.id === categoria).icono),
  ...extra
});

const APPS = [
  // ---------------------------------------------------------------- Navegadores
  a('chrome', 'Google Chrome', 'navegadores', '#4285f4', 'El navegador de Google, rápido y sincronizado con tu cuenta.',
    { winget: 'Google.Chrome', flatpak: 'com.google.Chrome' }, { menu: 'Google Chrome' }),
  a('firefox', 'Firefox', 'navegadores', '#ff7139', 'Navegador libre de Mozilla que respeta tu privacidad.',
    { winget: 'Mozilla.Firefox', flatpak: 'org.mozilla.firefox' }, { menu: 'Firefox', destacado: 'Libre, rápido y tuyo. El navegador que no vende tus datos.' }),
  a('brave', 'Brave', 'navegadores', '#fb542b', 'Bloquea anuncios y rastreadores sin extensiones.',
    { winget: 'Brave.Brave', flatpak: 'com.brave.Browser' }, { menu: 'Brave' }),
  a('edge', 'Microsoft Edge', 'navegadores', '#0c8de0', 'El navegador de Microsoft basado en Chromium.',
    { winget: 'Microsoft.Edge', flatpak: 'com.microsoft.Edge' }, { menu: 'Microsoft Edge' }),
  a('vivaldi', 'Vivaldi', 'navegadores', '#ef3939', 'Navegador hiperpersonalizable con pestañas en mosaico y correo.',
    { winget: 'Vivaldi.Vivaldi', flatpak: 'com.vivaldi.Vivaldi' }),
  a('opera', 'Opera', 'navegadores', '#ff1b2d', 'Navegador con VPN gratuita y mensajería integrada.',
    { winget: 'Opera.Opera', flatpak: 'com.opera.Opera' }),
  a('librewolf', 'LibreWolf', 'navegadores', '#00acff', 'Firefox reforzado para la privacidad, sin telemetría.',
    { winget: 'LibreWolf.LibreWolf', flatpak: 'io.gitlab.librewolf-community' }),
  a('chromium', 'Chromium', 'navegadores', '#5d8fdb', 'La base libre de Chrome, sin servicios de Google.',
    { winget: 'Hibbiki.Chromium', flatpak: 'org.chromium.Chromium' }),

  // ---------------------------------------------------------------- Comunicación
  a('discord', 'Discord', 'comunicacion', '#5865f2', 'Voz, vídeo y chat con tus amigos y comunidades.',
    { winget: 'Discord.Discord', flatpak: 'com.discordapp.Discord' }, { menu: 'Discord', destacado: 'Tu grupo, tus servidores, tu voz. Siempre a un clic.' }),
  a('whatsapp', 'WhatsApp', 'comunicacion', '#25d366', 'Tus chats de WhatsApp en el escritorio (ZapZap en Linux).',
    { winget: '9NKSQGP7F2NH', flatpak: 'com.rtosta.zapzap' }, { wingetFuente: 'msstore', menu: 'WhatsApp', icono: FH('com.rtosta.zapzap') }),
  a('telegram', 'Telegram', 'comunicacion', '#2aabee', 'Mensajería rápida en la nube con canales y bots.',
    { winget: 'Telegram.TelegramDesktop', flatpak: 'org.telegram.desktop', apt: 'telegram-desktop' }, { menu: 'Telegram' }),
  a('signal', 'Signal', 'comunicacion', '#3a76f0', 'Mensajería cifrada de extremo a extremo, sin anuncios.',
    { winget: 'OpenWhisperSystems.Signal', flatpak: 'org.signal.Signal' }),
  a('zoom', 'Zoom', 'comunicacion', '#2d8cff', 'Videollamadas y reuniones con cualquiera.',
    { winget: 'Zoom.Zoom', flatpak: 'us.zoom.Zoom' }, { menu: 'Zoom' }),
  a('slack', 'Slack', 'comunicacion', '#611f69', 'Canales de trabajo, mensajes y llamadas en equipo.',
    { winget: 'SlackTechnologies.Slack', flatpak: 'com.slack.Slack' }),
  a('teams', 'Microsoft Teams', 'comunicacion', '#5b5fc7', 'Chat y reuniones de Microsoft 365.',
    { winget: 'Microsoft.Teams', flatpak: 'com.github.IsmaelMartinez.teams_for_linux' }),
  a('element', 'Element', 'comunicacion', '#0dbd8b', 'Chat seguro y descentralizado sobre Matrix.',
    { winget: 'Element.Element', flatpak: 'im.riot.Riot' }),
  a('thunderbird', 'Thunderbird', 'comunicacion', '#0a84ff', 'Correo, calendario y contactos libres de Mozilla.',
    { winget: 'Mozilla.Thunderbird', flatpak: 'org.mozilla.Thunderbird', apt: 'thunderbird' }),

  // ---------------------------------------------------------------- Música y vídeo
  a('spotify', 'Spotify', 'multimedia', '#1ed760', 'Millones de canciones y pódcasts al instante.',
    { winget: 'Spotify.Spotify', flatpak: 'com.spotify.Client' }, { menu: 'Spotify', destacado: 'Toda la música del mundo. Pon play y olvídate.' }),
  a('vlc', 'VLC', 'multimedia', '#ff8800', 'Reproduce cualquier vídeo o audio, sin códecs extra.',
    { winget: 'VideoLAN.VLC', flatpak: 'org.videolan.VLC', apt: 'vlc' }, { menu: 'VLC media player' }),
  a('obs', 'OBS Studio', 'multimedia', '#7f5af0', 'Graba y emite en directo con calidad profesional.',
    { winget: 'OBSProject.OBSStudio', flatpak: 'com.obsproject.Studio', apt: 'obs-studio' }, { menu: 'OBS Studio', bin: 'obs', destacado: 'Graba tu pantalla o emite en directo como un profesional. Gratis.' }),
  a('handbrake', 'HandBrake', 'multimedia', '#d9473f', 'Convierte y comprime vídeos a cualquier formato.',
    { winget: 'HandBrake.HandBrake', flatpak: 'fr.handbrake.ghb', apt: 'handbrake' }, { bin: 'ghb' }),
  a('kodi', 'Kodi', 'multimedia', '#17b2e7', 'Centro multimedia para tu salón: pelis, series y música.',
    { winget: 'XBMCFoundation.Kodi', flatpak: 'tv.kodi.Kodi', apt: 'kodi' }),

  // ---------------------------------------------------------------- Juegos
  a('steam', 'Steam', 'juegos', '#1b6ec2', 'La mayor tienda de juegos de PC, con Proton en Linux.',
    { winget: 'Valve.Steam', flatpak: 'com.valvesoftware.Steam' }, { menu: 'Steam', destacado: 'Tu biblioteca de juegos, tus amigos y ofertas cada semana.' }),
  a('epic', 'Epic Games', 'juegos', '#5a5a5a', 'Tienda de Epic con juegos gratis cada semana.',
    { winget: 'EpicGames.EpicGamesLauncher' }, { menu: 'Epic Games Launcher', icono: 'game' }),
  a('heroic', 'Heroic', 'juegos', '#1fb8c9', 'Lanzador libre para Epic, GOG y Amazon Games.',
    { winget: 'HeroicGamesLauncher.HeroicGamesLauncher', flatpak: 'com.heroicgameslauncher.hgl' }),
  a('lutris', 'Lutris', 'juegos', '#ff9a00', 'Juega a todo en Linux: Wine, emuladores y tiendas.',
    { flatpak: 'net.lutris.Lutris', apt: 'lutris' }),
  a('prism', 'Prism Launcher', 'juegos', '#46a35e', 'Minecraft con instancias, mods y modpacks en un clic.',
    { winget: 'PrismLauncher.PrismLauncher', flatpak: 'org.prismlauncher.PrismLauncher' }, { menu: 'Prism Launcher' }),
  a('minecraft', 'Minecraft Launcher', 'juegos', '#62b47a', 'El lanzador oficial de Minecraft: Java y Bedrock.',
    { winget: 'Mojang.MinecraftLauncher' }, { menu: 'Minecraft Launcher', icono: FH('com.mojang.Minecraft') }),
  a('sober', 'Sober', 'juegos', '#e2231a', 'Roblox en Linux, rápido y sin trucos.',
    { flatpak: 'org.vinegarhq.Sober' }),
  a('gog', 'GOG Galaxy', 'juegos', '#86328a', 'Tus juegos de GOG sin DRM y todas tus tiendas juntas.',
    { winget: 'GOG.Galaxy' }, { menu: 'GOG GALAXY', icono: 'game' }),
  a('ea', 'EA app', 'juegos', '#ff4747', 'Juegos de Electronic Arts y EA Play.',
    { winget: 'ElectronicArts.EADesktop' }, { menu: 'EA', icono: 'game' }),
  a('ubisoft', 'Ubisoft Connect', 'juegos', '#2a7fff', 'Lanzador de los juegos de Ubisoft.',
    { winget: 'Ubisoft.Connect' }, { menu: 'Ubisoft Connect', icono: 'game' }),
  a('retroarch', 'RetroArch', 'juegos', '#8a8a8a', 'Todos los emuladores retro en una sola app.',
    { winget: 'Libretro.RetroArch', flatpak: 'org.libretro.RetroArch', apt: 'retroarch' }),
  a('bottles', 'Bottles', 'juegos', '#e66a5b', 'Ejecuta programas de Windows en Linux con Wine, fácil.',
    { flatpak: 'com.usebottles.bottles' }),
  a('protonup', 'ProtonUp-Qt', 'juegos', '#c13584', 'Instala Proton-GE y Wine-GE para jugar mejor en Linux.',
    { flatpak: 'net.davidotek.pupgui2' }),

  // ---------------------------------------------------------------- Creatividad
  a('gimp', 'GIMP', 'creatividad', '#8a7b5c', 'Editor de imágenes libre y potente.',
    { winget: 'GIMP.GIMP.3', flatpak: 'org.gimp.GIMP', apt: 'gimp' }, { menu: 'GIMP' }),
  a('krita', 'Krita', 'creatividad', '#3bb0e8', 'Pintura digital e ilustración para artistas.',
    { winget: 'KDE.Krita', flatpak: 'org.kde.krita', apt: 'krita' }, { menu: 'Krita', destacado: 'Pinceles increíbles, lienzo infinito. Dibuja sin límites.' }),
  a('blender', 'Blender', 'creatividad', '#f5792a', 'Modelado 3D, animación y render de cine.',
    { winget: 'BlenderFoundation.Blender', flatpak: 'org.blender.Blender', apt: 'blender' }, { menu: 'Blender', destacado: 'Del boceto al render final: 3D profesional, libre y gratis.' }),
  a('inkscape', 'Inkscape', 'creatividad', '#6a6a6a', 'Diseño vectorial: logos, iconos e ilustraciones.',
    { winget: 'Inkscape.Inkscape', flatpak: 'org.inkscape.Inkscape', apt: 'inkscape' }),
  a('audacity', 'Audacity', 'creatividad', '#2a5bd7', 'Graba y edita audio de forma sencilla.',
    { winget: 'Audacity.Audacity', flatpak: 'org.audacityteam.Audacity', apt: 'audacity' }),
  a('kdenlive', 'Kdenlive', 'creatividad', '#527eb2', 'Editor de vídeo libre con línea de tiempo multipista.',
    { winget: 'KDE.Kdenlive', flatpak: 'org.kde.kdenlive', apt: 'kdenlive' }),
  a('shotcut', 'Shotcut', 'creatividad', '#2f7bc4', 'Editor de vídeo ligero y multiplataforma.',
    { winget: 'Meltytech.Shotcut', flatpak: 'org.shotcut.Shotcut', apt: 'shotcut' }),
  a('darktable', 'darktable', 'creatividad', '#c9a227', 'Revelado RAW y gestión de fotos para fotógrafos.',
    { winget: 'darktable.darktable', flatpak: 'org.darktable.Darktable', apt: 'darktable' }),
  a('paintnet', 'Paint.NET', 'creatividad', '#3d8fd1', 'Editor de fotos sencillo y rápido para Windows.',
    { winget: 'dotPDN.PaintDotNet' }, { menu: 'paint.net', icono: 'image' }),
  a('davinci', 'DaVinci Resolve', 'creatividad', '#e4565e', 'Edición y etalonaje de vídeo profesional (descarga en su web).',
    {}, { enlace: 'https://www.blackmagicdesign.com/products/davinciresolve', icono: 'play' }),

  // ---------------------------------------------------------------- Desarrollo
  a('vscode', 'Visual Studio Code', 'desarrollo', '#2c9dea', 'Editor de código ligero con miles de extensiones.',
    { winget: 'Microsoft.VisualStudioCode', flatpak: 'com.visualstudio.code' }, { menu: 'Visual Studio Code', destacado: 'El editor de código que usa medio mundo. Ligero y ampliable.' }),
  a('vscodium', 'VSCodium', 'desarrollo', '#2f80ed', 'VS Code libre, sin telemetría de Microsoft.',
    { winget: 'VSCodium.VSCodium', flatpak: 'com.vscodium.codium' }),
  a('git', 'Git', 'desarrollo', '#f05032', 'Control de versiones, imprescindible para programar.',
    { winget: 'Git.Git', apt: 'git' }, { cli: true, icono: 'code' }),
  a('nodejs', 'Node.js', 'desarrollo', '#5fa04e', 'JavaScript fuera del navegador (versión LTS).',
    { winget: 'OpenJS.NodeJS.LTS', apt: 'nodejs' }, { cli: true, icono: 'terminal' }),
  a('python', 'Python', 'desarrollo', '#3776ab', 'El lenguaje más popular para aprender y automatizar.',
    { winget: 'Python.Python.3.13', apt: 'python3' }, { cli: true, icono: 'terminal' }),
  a('docker', 'Docker', 'desarrollo', '#1d63ed', 'Contenedores para desarrollar y desplegar sin líos.',
    { winget: 'Docker.DockerDesktop', apt: 'docker.io' }, { menu: 'Docker Desktop', icono: 'cube' }),
  a('githubdesktop', 'GitHub Desktop', 'desarrollo', '#8250df', 'Git con interfaz gráfica, sin comandos.',
    { winget: 'GitHub.GitHubDesktop', flatpak: 'io.github.shiftey.Desktop' }, { menu: 'GitHub Desktop' }),
  a('terminal', 'Windows Terminal', 'desarrollo', '#4d4d4d', 'Terminal moderna con pestañas para Windows.',
    { winget: 'Microsoft.WindowsTerminal' }, { menu: 'Terminal', icono: 'terminal' }),
  a('sublime', 'Sublime Text', 'desarrollo', '#ff9800', 'Editor de texto rapidísimo y elegante.',
    { winget: 'SublimeHQ.SublimeText.4', flatpak: 'com.sublimetext.three' }),
  a('intellij', 'IntelliJ IDEA', 'desarrollo', '#fe315d', 'IDE de JetBrains para Java y Kotlin (Community).',
    { winget: 'JetBrains.IntelliJIDEA.Community', flatpak: 'com.jetbrains.IntelliJ-IDEA-Community' }),

  // ---------------------------------------------------------------- Productividad
  a('libreoffice', 'LibreOffice', 'productividad', '#18a303', 'Suite ofimática libre: textos, hojas y presentaciones.',
    { winget: 'TheDocumentFoundation.LibreOffice', flatpak: 'org.libreoffice.LibreOffice', apt: 'libreoffice' }, { menu: 'LibreOffice', destacado: 'Escribe, calcula y presenta. Compatible con Office, gratis para siempre.' }),
  a('onlyoffice', 'ONLYOFFICE', 'productividad', '#ff6f3d', 'Ofimática con la mejor compatibilidad con Word y Excel.',
    { winget: 'ONLYOFFICE.DesktopEditors', flatpak: 'org.onlyoffice.desktopeditors' }),
  a('notion', 'Notion', 'productividad', '#9b9a97', 'Notas, wikis y tareas en un solo espacio.',
    { winget: 'Notion.Notion' }, { menu: 'Notion', icono: 'note' }),
  a('obsidian', 'Obsidian', 'productividad', '#7c3aed', 'Notas en Markdown enlazadas, tu segundo cerebro.',
    { winget: 'Obsidian.Obsidian', flatpak: 'md.obsidian.Obsidian' }, { menu: 'Obsidian' }),
  a('joplin', 'Joplin', 'productividad', '#1071d3', 'Notas y listas cifradas que se sincronizan.',
    { winget: 'Joplin.Joplin', flatpak: 'net.cozic.joplin_desktop' }),
  a('sumatra', 'SumatraPDF', 'productividad', '#e0b100', 'Lector de PDF y libros, ligero como una pluma.',
    { winget: 'SumatraPDF.SumatraPDF' }, { menu: 'SumatraPDF', icono: 'file' }),
  a('protonmail', 'Proton Mail', 'productividad', '#6d4aff', 'Correo cifrado de Suiza, privado por defecto.',
    { winget: 'Proton.ProtonMail', flatpak: 'me.proton.Mail' }),

  // ---------------------------------------------------------------- Utilidades
  a('7zip', '7-Zip', 'utilidades', '#3a3a3a', 'Comprime y descomprime ZIP, RAR, 7z y más.',
    { winget: '7zip.7zip', apt: '7zip' }, { menu: '7-Zip File Manager', icono: 'folder' }),
  a('peazip', 'PeaZip', 'utilidades', '#3fae49', 'Gestor de archivos comprimidos libre y bonito.',
    { winget: 'Giorgiotani.Peazip', flatpak: 'io.github.peazip.PeaZip' }),
  a('qbittorrent', 'qBittorrent', 'utilidades', '#2f67ba', 'Cliente BitTorrent libre y sin anuncios.',
    { winget: 'qBittorrent.qBittorrent', flatpak: 'org.qbittorrent.qBittorrent', apt: 'qbittorrent' }),
  a('keepassxc', 'KeePassXC', 'utilidades', '#6cac4d', 'Gestor de contraseñas local y cifrado.',
    { winget: 'KeePassXCTeam.KeePassXC', flatpak: 'org.keepassxc.KeePassXC', apt: 'keepassxc' }),
  a('bitwarden', 'Bitwarden', 'utilidades', '#175ddc', 'Gestor de contraseñas en la nube, libre.',
    { winget: 'Bitwarden.Bitwarden', flatpak: 'com.bitwarden.desktop' }, { menu: 'Bitwarden' }),
  a('anydesk', 'AnyDesk', 'utilidades', '#ef443b', 'Control remoto para ayudar (o que te ayuden).',
    { winget: 'AnyDesk.AnyDesk', flatpak: 'com.anydesk.Anydesk' }, { menu: 'AnyDesk' }),
  a('rustdesk', 'RustDesk', 'utilidades', '#024eff', 'Escritorio remoto libre, alternativa a AnyDesk.',
    { flatpak: 'com.rustdesk.RustDesk' }),
  a('localsend', 'LocalSend', 'utilidades', '#008080', 'Pasa archivos entre tus dispositivos por la red local.',
    { winget: 'LocalSend.LocalSend', flatpak: 'org.localsend.localsend_app' }),
  a('protonvpn', 'Proton VPN', 'utilidades', '#66deb1', 'VPN gratuita y sin registros de Proton.',
    { winget: 'Proton.ProtonVPN', flatpak: 'com.protonvpn.www' }),
  a('powertoys', 'PowerToys', 'utilidades', '#6b69d6', 'Superpoderes para Windows: FancyZones, buscador y más.',
    { winget: 'Microsoft.PowerToys' }, { menu: 'PowerToys', icono: 'spark' }),
  a('everything', 'Everything', 'utilidades', '#ff8c1a', 'Encuentra cualquier archivo al instante.',
    { winget: 'voidtools.Everything' }, { menu: 'Everything', icono: 'search' }),
  a('flatseal', 'Flatseal', 'utilidades', '#4a90d9', 'Revisa y cambia los permisos de tus apps Flatpak.',
    { flatpak: 'com.github.tchx84.Flatseal' }),
  a('missioncenter', 'Mission Center', 'utilidades', '#3584e4', 'Monitor del sistema: CPU, RAM, disco y GPU.',
    { flatpak: 'io.missioncenter.MissionCenter' })
];

// Packs tipo Ninite: un clic marca varias apps.
const PACKS = [
  { id: 'esencial', nombre: 'Lo esencial', descripcion: 'Navegador, música, vídeo y compresor', color: '#9db4ff', icono: 'spark', apps: ['firefox', 'vlc', 'spotify', '7zip', 'libreoffice'] },
  { id: 'gaming', nombre: 'Gaming', descripcion: 'Tiendas, voz y emisión', color: '#ff6b81', icono: 'game', apps: ['steam', 'epic', 'heroic', 'discord', 'obs', 'lutris', 'protonup'] },
  { id: 'creador', nombre: 'Creadores', descripcion: 'Imagen, 3D, audio y vídeo', color: '#ffb057', icono: 'palette', apps: ['gimp', 'krita', 'blender', 'inkscape', 'audacity', 'kdenlive', 'obs'] },
  { id: 'dev', nombre: 'Programar', descripcion: 'Editor, Git, Node, Python y Docker', color: '#7ee0b5', icono: 'code', apps: ['vscode', 'git', 'nodejs', 'python', 'docker', 'githubdesktop'] }
];

module.exports = { APPS, CATEGORIAS, PACKS, FH };
