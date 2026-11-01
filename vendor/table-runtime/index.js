// Chronexus Table. Apache-2.0. First-party sources pinned in manifest.json.
// Regenerate with node scripts/tables/sync-runtime.mjs.
export function createTableRuntime(locale) {
const window={};
const localStorage={getItem:key=>key==='chronexus-web-locale'?locale:globalThis.localStorage.getItem(key),setItem:(key,value)=>{if(key!=='chronexus-web-locale')globalThis.localStorage.setItem(key,value);}};
// Chronexus Server web interface translations (M25.11). Classic script loaded before app.js;
// exposes window.ChronexusI18n. English is the source and fallback. The ten locales match the
// desktop app. Messages from the API itself stay in English.
(function () {
  const LOCALES = [
    ["en", "English"], ["it", "Italiano"], ["de", "Deutsch"], ["fr", "Français"],
    ["es", "Español"], ["pt-BR", "Português (Brasil)"], ["ja", "日本語"], ["ko", "한국어"],
    ["zh-Hans", "简体中文"], ["ar", "العربية"],
  ];
  const ORDER = LOCALES.map(([code]) => code);
  // One row per message: en, it, de, fr, es, pt-BR, ja, ko, zh-Hans, ar.
  const M = {
    "save": ["Save","Salva","Speichern","Enregistrer","Guardar","Salvar","保存","저장","保存","حفظ"],
    "search": ["Search","Cerca","Suchen","Rechercher","Buscar","Buscar","検索","검색","搜索","بحث"],
    "import": ["Import","Importa","Importieren","Importer","Importar","Importar","読み込む","가져오기","导入","استيراد"],
    "importGeometry": ["Use UVTT walls and lights","Usa muri e luci UVTT","UVTT-Wände und Lichter verwenden","Utiliser les murs et lumières UVTT","Usar muros y luces UVTT","Usar paredes e luzes UVTT","UVTTの壁と光を使用","UVTT 벽과 조명 사용","使用UVTT墙壁和光源","استخدام جدران وأضواء UVTT"],
    "tool.reveal": ["Reveal rectangle","Rivela rettangolo","Rechteck aufdecken","Révéler un rectangle","Revelar rectángulo","Revelar retângulo","矩形を公開","사각형 공개","揭示矩形","كشف مستطيل"],
    "tool.cover": ["Cover rectangle","Nascondi rettangolo","Rechteck verdecken","Masquer un rectangle","Ocultar rectángulo","Ocultar retângulo","矩形を隠す","사각형 가리기","遮盖矩形","حجب مستطيل"],
    "tool.brushReveal": ["Reveal brush","Pennello rivela","Aufdeckpinsel","Pinceau de révélation","Pincel para revelar","Pincel de revelação","公開ブラシ","공개 브러시","揭示画笔","فرشاة الكشف"],
    "tool.brushCover": ["Cover brush","Pennello nascondi","Verdeckpinsel","Pinceau de masquage","Pincel para ocultar","Pincel de ocultação","隠蔽ブラシ","가리기 브러시","遮盖画笔","فرشاة الحجب"],
    "tool.polygon": ["Reveal polygon","Rivela poligono","Polygon aufdecken","Révéler un polygone","Revelar polígono","Revelar polígono","多角形を公開","다각형 공개","揭示多边形","كشف مضلع"],
    "fogEditor": ["Fog and vision","Nebbia e visione","Nebel und Sicht","Brouillard et vision","Niebla y visión","Névoa e visão","霧と視界","안개와 시야","迷雾与视野","الضباب والرؤية"],
    "fogEnabled": ["Enable fog","Abilita nebbia","Nebel aktivieren","Activer le brouillard","Activar niebla","Ativar névoa","霧を有効化","안개 사용","启用迷雾","تفعيل الضباب"],
    "visionEnabled": ["Restrict to token vision","Limita alla visione dei token","Auf Tokensicht beschränken","Limiter à la vision des pions","Limitar a la visión de fichas","Limitar à visão dos marcadores","トークンの視界に制限","토큰 시야로 제한","限制为棋子视野","تقييد الرؤية برموز الشخصيات"],
    "fogHelp": ["Fog uses 32 × 32 tiles. Paint rectangles or brush strokes; click polygon points, then finish. Vision uses owned tokens, walls and lights. Save to apply.","La nebbia usa 32 × 32 riquadri. Disegna rettangoli o pennellate; clicca i vertici del poligono e completa. La visione usa token propri, muri e luci. Salva per applicare.","Nebel verwendet 32 × 32 Felder. Rechtecke oder Pinselstriche malen; Polygonpunkte anklicken und abschließen. Sicht nutzt eigene Tokens, Wände und Licht. Zum Anwenden speichern.","Le brouillard utilise 32 × 32 cases. Tracez des rectangles ou des coups de pinceau ; cliquez les sommets du polygone puis terminez. La vision utilise vos pions, les murs et les lumières. Enregistrez pour appliquer.","La niebla usa 32 × 32 casillas. Pinta rectángulos o trazos; marca los vértices del polígono y termina. La visión usa fichas propias, muros y luces. Guarda para aplicar.","A névoa usa 32 × 32 células. Pinte retângulos ou traços; clique nos vértices do polígono e finalize. A visão usa marcadores próprios, paredes e luzes. Salve para aplicar.","霧は32 × 32マスです。矩形やブラシで描くか、多角形の頂点をクリックして確定します。視界には自分のトークン、壁、光を使用します。保存して適用してください。","안개는 32 × 32칸을 사용합니다. 사각형이나 브러시로 그리거나 다각형 꼭짓점을 클릭한 뒤 완료하세요. 시야는 소유 토큰, 벽과 조명을 사용합니다. 저장하여 적용하세요.","迷雾使用32 × 32格。绘制矩形或笔画，或点击多边形顶点后完成。视野依据所属棋子、墙壁和光源计算。保存以应用。","يستخدم الضباب شبكة 32 × 32. ارسم مستطيلات أو ضربات فرشاة، أو انقر رؤوس المضلع ثم أكمله. تعتمد الرؤية على رموزك والجدران والأضواء. احفظ للتطبيق."],
    "brushPixels": ["Brush radius (pixels)","Raggio pennello (pixel)","Pinselradius (Pixel)","Rayon du pinceau (pixels)","Radio del pincel (píxeles)","Raio do pincel (pixels)","ブラシ半径（ピクセル）","브러시 반경(픽셀)","画笔半径（像素）","نصف قطر الفرشاة (بكسل)"],
    "undoFog": ["Undo last stroke","Annulla ultima pennellata","Letzten Strich rückgängig","Annuler le dernier trait","Deshacer último trazo","Desfazer último traço","最後の描画を取り消す","마지막 획 취소","撤销上一笔","التراجع عن آخر ضربة"],
    "finishPolygon": ["Finish polygon","Completa poligono","Polygon abschließen","Terminer le polygone","Terminar polígono","Finalizar polígono","多角形を確定","다각형 완료","完成多边形","إكمال المضلع"],
    "revealAll": ["Reveal all","Rivela tutto","Alles aufdecken","Tout révéler","Revelar todo","Revelar tudo","すべて公開","모두 공개","全部揭示","كشف الكل"],
    "coverAll": ["Cover all","Nascondi tutto","Alles verdecken","Tout masquer","Ocultar todo","Ocultar tudo","すべて隠す","모두 가리기","全部遮盖","حجب الكل"],
    "coverAllConfirm": ["Replace all reveal strokes with complete fog?","Sostituire tutte le aree rivelate con nebbia completa?","Alle aufgedeckten Bereiche vollständig vernebeln?","Remplacer toutes les zones révélées par du brouillard ?","¿Cubrir con niebla todas las zonas reveladas?","Cobrir todas as áreas reveladas com névoa?","公開済み領域をすべて霧で覆いますか？","공개 영역을 모두 안개로 덮을까요?","将所有已揭示区域重新遮盖吗？","هل تريد حجب جميع المناطق المكشوفة بالضباب؟"],
    "endX": ["End X (pixels)","X finale (pixel)","Ende X (Pixel)","X final (pixels)","X final (píxeles)","X final (pixels)","終点X（ピクセル）","끝 X(픽셀)","终点X（像素）","نهاية X (بكسل)"],
    "endY": ["End Y (pixels)","Y finale (pixel)","Ende Y (Pixel)","Y final (pixels)","Y final (píxeles)","Y final (pixels)","終点Y（ピクセル）","끝 Y(픽셀)","终点Y（像素）","نهاية Y (بكسل)"],
    "door": ["Door","Porta","Tür","Porte","Puerta","Porta","扉","문","门","باب"],
    "wall": ["Wall","Muro","Wand","Mur","Muro","Parede","壁","벽","墙","جدار"],
    "addWall": ["Add wall or door","Aggiungi muro o porta","Wand oder Tür hinzufügen","Ajouter un mur ou une porte","Añadir muro o puerta","Adicionar parede ou porta","壁または扉を追加","벽 또는 문 추가","添加墙或门","إضافة جدار أو باب"],
    "revealRectangle": ["Reveal these coordinates","Rivela queste coordinate","Diese Koordinaten aufdecken","Révéler ces coordonnées","Revelar estas coordenadas","Revelar estas coordenadas","この座標を公開","이 좌표 공개","揭示这些坐标","كشف هذه الإحداثيات"],
    "visionRange": ["Vision or light range","Portata visione o luce","Sicht- oder Lichtweite","Portée de vision ou de lumière","Alcance de visión o luz","Alcance de visão ou luz","視界または光の範囲","시야 또는 조명 범위","视野或光照范围","مدى الرؤية أو الضوء"],
    "darkvision": ["Darkvision","Scurovisione","Dunkelsicht","Vision dans le noir","Visión en la oscuridad","Visão no escuro","暗視","암시야","黑暗视觉","الرؤية في الظلام"],
    "setVision": ["Set selected token vision","Imposta visione del token selezionato","Sicht des gewählten Tokens festlegen","Définir la vision du pion sélectionné","Configurar visión de la ficha elegida","Definir visão do marcador selecionado","選択トークンの視界を設定","선택한 토큰 시야 설정","设置所选棋子视野","ضبط رؤية الرمز المحدد"],
    "addLight": ["Add light","Aggiungi luce","Licht hinzufügen","Ajouter une lumière","Añadir luz","Adicionar luz","光源を追加","조명 추가","添加光源","إضافة ضوء"],
    "light": ["Light","Luce","Licht","Lumière","Luz","Luz","光源","조명","光源","ضوء"],
    "openDoor": ["Open door","Apri porta","Tür öffnen","Ouvrir la porte","Abrir puerta","Abrir porta","扉を開ける","문 열기","开门","فتح الباب"],
    "closeDoor": ["Close door","Chiudi porta","Tür schließen","Fermer la porte","Cerrar puerta","Fechar porta","扉を閉じる","문 닫기","关门","إغلاق الباب"],
    "statBlock": ["Stat block and actions","Statistiche e azioni","Werte und Aktionen","Statistiques et actions","Estadísticas y acciones","Estatísticas e ações","能力値とアクション","능력치와 행동","属性与动作","الإحصاءات والإجراءات"],
    "monsterLibrary": ["Monster library","Libreria mostri","Monsterbibliothek","Bibliothèque de monstres","Biblioteca de monstruos","Biblioteca de monstros","モンスター一覧","몬스터 라이브러리","怪物库","مكتبة الوحوش"],
    "newMonster": ["New monster","Nuovo mostro","Neues Monster","Nouveau monstre","Nuevo monstruo","Novo monstro","新規モンスター","새 몬스터","新建怪物","وحش جديد"],
    "saveMonster": ["Save monster","Salva mostro","Monster speichern","Enregistrer le monstre","Guardar monstruo","Salvar monstro","モンスターを保存","몬스터 저장","保存怪物","حفظ الوحش"],
    "encounterLibrary": ["Encounter presets","Incontri salvati","Begegnungsvorlagen","Rencontres enregistrées","Encuentros guardados","Encontros salvos","遭遇プリセット","전투 프리셋","遭遇预设","قوالب المواجهات"],
    "encounterName": ["Encounter name","Nome incontro","Begegnungsname","Nom de la rencontre","Nombre del encuentro","Nome do encontro","遭遇名","전투 이름","遭遇名称","اسم المواجهة"],
    "newEncounter": ["New encounter","Nuovo incontro","Neue Begegnung","Nouvelle rencontre","Nuevo encuentro","Novo encontro","新規遭遇","새 전투","新建遭遇","مواجهة جديدة"],
    "saveEncounter": ["Save encounter","Salva incontro","Begegnung speichern","Enregistrer la rencontre","Guardar encuentro","Salvar encontro","遭遇を保存","전투 저장","保存遭遇","حفظ المواجهة"],
    "addToEncounter": ["Add to encounter","Aggiungi all'incontro","Zur Begegnung hinzufügen","Ajouter à la rencontre","Añadir al encuentro","Adicionar ao encontro","遭遇に追加","전투에 추가","加入遭遇","إضافة إلى المواجهة"],
    "deployEncounter": ["Place encounter in scene","Inserisci incontro nella scena","Begegnung in Szene platzieren","Placer la rencontre dans la scène","Colocar encuentro en escena","Colocar encontro na cena","シーンに遭遇を配置","장면에 전투 배치","在场景中放置遭遇","وضع المواجهة في المشهد"],
    "assetLibrary": ["Image library","Libreria immagini","Bildbibliothek","Bibliothèque d'images","Biblioteca de imágenes","Biblioteca de imagens","画像ライブラリ","이미지 라이브러리","图片库","مكتبة الصور"],
    "assetName": ["Image name","Nome immagine","Bildname","Nom de l'image","Nombre de imagen","Nome da imagem","画像名","이미지 이름","图片名称","اسم الصورة"],
    "importComputer": ["Import from computer","Importa dal computer","Vom Computer importieren","Importer depuis l'ordinateur","Importar del ordenador","Importar do computador","パソコンから読み込む","컴퓨터에서 가져오기","从电脑导入","استيراد من الكمبيوتر"],
    "placeAsset": ["Place on grid","Inserisci nella griglia","Im Raster platzieren","Placer sur la grille","Colocar en cuadrícula","Colocar na grade","グリッドに配置","격자에 배치","放置到网格","وضع على الشبكة"],
    "usePortrait": ["Use for monster portrait","Usa come ritratto del mostro","Als Monsterporträt verwenden","Utiliser comme portrait du monstre","Usar como retrato del monstruo","Usar como retrato do monstro","モンスターの画像に使用","몬스터 초상화로 사용","用作怪物头像","استخدام كصورة للوحش"],
    "publicCatalog": ["Public catalogs","Cataloghi pubblici","Öffentliche Kataloge","Catalogues publics","Catálogos públicos","Catálogos públicos","公開カタログ","공개 카탈로그","公共目录","الفهارس العامة"],
    "catalog": ["Catalog","Catalogo","Katalog","Catalogue","Catálogo","Catálogo","カタログ","카탈로그","目录","الفهرس"],
    "catalogPrivacy": ["Search sends only the public term you enter. Images: Wikimedia Commons, open licences only. Monsters: SRD 2014. Imported copies remain editable on this server.","La ricerca invia solo il termine pubblico inserito. Immagini: Wikimedia Commons, solo licenze aperte. Mostri: SRD 2014. Le copie importate restano modificabili su questo server.","Die Suche sendet nur den eingegebenen öffentlichen Begriff. Bilder: Wikimedia Commons, nur offene Lizenzen. Monster: SRD 2014. Importierte Kopien bleiben auf diesem Server bearbeitbar.","La recherche envoie uniquement le terme public saisi. Images : Wikimedia Commons, licences ouvertes uniquement. Monstres : SRD 2014. Les copies importées restent modifiables sur ce serveur.","La búsqueda solo envía el término público introducido. Imágenes: Wikimedia Commons, solo licencias abiertas. Monstruos: SRD 2014. Las copias importadas son editables en este servidor.","A busca envia apenas o termo público digitado. Imagens: Wikimedia Commons, apenas licenças abertas. Monstros: SRD 2014. As cópias importadas permanecem editáveis neste servidor.","検索では入力した公開用語のみ送信します。画像はWikimedia Commonsのオープンライセンスのみ、モンスターはSRD 2014です。読み込んだコピーはこのサーバーで編集できます。","검색은 입력한 공개 용어만 전송합니다. 이미지는 Wikimedia Commons의 공개 라이선스만, 몬스터는 SRD 2014를 사용합니다. 가져온 사본은 이 서버에서 편집할 수 있습니다.","搜索仅发送输入的公共术语。图片来自Wikimedia Commons，仅限开放许可；怪物来自SRD 2014。导入的副本可在此服务器上编辑。","يرسل البحث المصطلح العام الذي تدخله فقط. الصور من ويكيميديا كومنز بتراخيص مفتوحة فقط، والوحوش من SRD 2014. تبقى النسخ المستوردة قابلة للتعديل على هذا الخادم."],
    "catalogEmpty": ["No compatible results. Try another term or import a local file.","Nessun risultato compatibile. Prova un altro termine o importa un file locale.","Keine passenden Ergebnisse. Anderen Begriff versuchen oder lokale Datei importieren.","Aucun résultat compatible. Essayez un autre terme ou importez un fichier local.","Sin resultados compatibles. Prueba otro término o importa un archivo local.","Nenhum resultado compatível. Tente outro termo ou importe um arquivo local.","対応する結果がありません。別の語句を試すか、ローカルファイルを読み込んでください。","호환되는 결과가 없습니다. 다른 검색어를 시도하거나 로컬 파일을 가져오세요.","没有兼容结果。请尝试其他关键词或导入本地文件。","لا توجد نتائج متوافقة. جرّب مصطلحًا آخر أو استورد ملفًا محليًا."],
    "reviewImport": ["Review the imported draft, then save.","Controlla la bozza importata, poi salva.","Importierten Entwurf prüfen, dann speichern.","Vérifiez le brouillon importé, puis enregistrez.","Revisa el borrador importado y guarda.","Revise o rascunho importado e salve.","読み込んだ下書きを確認して保存してください。","가져온 초안을 검토한 뒤 저장하세요.","检查导入的草稿后保存。","راجع المسودة المستوردة ثم احفظها."],
    tokenStatus: ["Public status (manual)","Stato pubblico (manuale)","Öffentlicher Status (manuell)","Statut public (manuel)","Estado público (manual)","Estado público (manual)","公開状態（手動）","공개 상태 (수동)","公开状态（手动）","الحالة العامة (يدوية)"],
    "combat": ["Combat tracker", "Tracker combattimento", "Kampftracker", "Suivi du combat", "Seguimiento de combate", "Controle de combate", "戦闘管理", "전투 추적기", "战斗追踪", "متعقب القتال"],
    "combatants": ["Combatants", "Combattenti", "Kampfteilnehmer", "Combattants", "Combatientes", "Combatentes", "戦闘参加者", "전투 참가자", "参战者", "المقاتلون"],
    "combatControls": ["Initiative, HP and rolls", "Iniziativa, PF e tiri", "Initiative, TP und Würfe", "Initiative, PV et jets", "Iniciativa, PG y tiradas", "Iniciativa, PV e rolagens", "イニシアチブ・HP・ロール", "우선권, HP 및 주사위", "先攻、生命值与掷骰", "المبادرة ونقاط الحياة والرميات"],
    "amount": ["Amount", "Quantità", "Betrag", "Quantité", "Cantidad", "Quantidade", "量", "수량", "数值", "المقدار"],
    "hitPoints": ["HP", "PF", "TP", "PV", "PG", "PV", "HP", "HP", "生命值", "نقاط الحياة"],
    "maxHitPoints": ["Maximum HP", "PF massimi", "Maximale TP", "PV maximum", "PG máximos", "PV máximos", "最大HP", "최대 HP", "最大生命值", "الحد الأقصى لنقاط الحياة"],
    "armorClass": ["Armour class", "Classe armatura", "Rüstungsklasse", "Classe d’armure", "Clase de armadura", "Classe de armadura", "アーマークラス", "방어도", "护甲等级", "فئة الدرع"],
    "showHitPoints": ["Show HP to others", "Mostra PF agli altri", "TP anderen zeigen", "Montrer les PV aux autres", "Mostrar PG a otros", "Mostrar PV aos outros", "他の人にHPを表示", "다른 사람에게 HP 공개", "向他人显示生命值", "عرض نقاط الحياة للآخرين"],
    "gmNote": ["GM-only note", "Nota riservata al GM", "Nur für die Spielleitung", "Note privée du MJ", "Nota privada del DJ", "Nota privada do mestre", "GM専用メモ", "GM 전용 메모", "主持人私密备注", "ملاحظة خاصة بمدير اللعبة"],
    "loadVitals": ["Load selected token values", "Carica valori del token selezionato", "Werte der gewählten Figur laden", "Charger les valeurs du pion sélectionné", "Cargar valores de la ficha", "Carregar valores da peça", "選択したトークンの値を読込", "선택한 토큰 값 불러오기", "载入所选棋子的数值", "تحميل قيم الرمز المحدد"],
    "applyHitPoints": ["Apply HP change", "Applica modifica PF", "TP-Änderung anwenden", "Appliquer la modification des PV", "Aplicar cambio de PG", "Aplicar alteração de PV", "HPの変更を適用", "HP 변경 적용", "应用生命值变更", "تطبيق تغيير نقاط الحياة"],
    "tokenOnly": ["This changes only table tokens. Rolls never apply damage or change your journal or sheet.", "Cambia solo i token del tavolo. I tiri non applicano danni e non modificano diario o scheda.", "Dies ändert nur Tischfiguren. Würfe verursachen keinen automatischen Schaden und ändern weder Journal noch Charakterbogen.", "Ceci modifie uniquement les pions. Les jets n’appliquent aucun dégât et ne modifient ni journal ni fiche.", "Solo cambia fichas de la mesa. Las tiradas no aplican daño ni cambian el diario o la ficha.", "Altera apenas peças da mesa. Rolagens não aplicam dano nem alteram diário ou ficha.", "卓のトークンのみを変更します。ロールでダメージや日誌・シートは変更されません。", "테이블 토큰만 변경됩니다. 주사위는 피해를 적용하거나 일지와 시트를 변경하지 않습니다.", "仅更改游戏桌棋子。掷骰不会自动造成伤害，也不更改日志或角色卡。", "يغيّر رموز الطاولة فقط. لا تطبق الرميات ضررًا ولا تغيّر اليوميات أو ورقة الشخصية."],
    "saveVitals": ["Save HP and armour", "Salva PF e armatura", "TP und Rüstung speichern", "Enregistrer PV et armure", "Guardar PG y armadura", "Salvar PV e armadura", "HPとアーマーを保存", "HP와 방어도 저장", "保存生命值与护甲", "حفظ نقاط الحياة والدرع"],
    "damage": ["Apply damage", "Applica danni", "Schaden anwenden", "Appliquer des dégâts", "Aplicar daño", "Aplicar dano", "ダメージを適用", "피해 적용", "应用伤害", "تطبيق الضرر"],
    "healing": ["Apply healing", "Applica guarigione", "Heilung anwenden", "Appliquer des soins", "Aplicar curación", "Aplicar cura", "回復を適用", "치유 적용", "应用治疗", "تطبيق الشفاء"],
    "initiative": ["Initiative / roll modifier", "Iniziativa / modificatore tiro", "Initiative / Wurfmodifikator", "Initiative / modificateur de jet", "Iniciativa / modificador", "Iniciativa / modificador", "イニシアチブ／修正値", "우선권 / 주사위 보정", "先攻／掷骰调整值", "المبادرة / معدل الرمية"],
    "secretRoll": ["GM-secret roll", "Tiro segreto del GM", "Geheimer SL-Wurf", "Jet secret du MJ", "Tirada secreta del DJ", "Rolagem secreta do mestre", "GMの非公開ロール", "GM 비공개 주사위", "主持人秘密掷骰", "رمية سرية لمدير اللعبة"],
    "setInitiative": ["Set initiative manually", "Imposta iniziativa manuale", "Initiative manuell setzen", "Définir l’initiative", "Fijar iniciativa manual", "Definir iniciativa manual", "イニシアチブを手入力", "우선권 직접 설정", "手动设置先攻", "تعيين المبادرة يدويًا"],
    "rollInitiative": ["Roll d20 + modifier", "Tira d20 + modificatore", "W20 + Modifikator würfeln", "Lancer d20 + modificateur", "Tirar d20 + modificador", "Rolar d20 + modificador", "d20＋修正値をロール", "d20 + 보정치 굴리기", "掷d20＋调整值", "رمية d20 + المعدل"],
    "diceCount": ["Number of dice", "Numero dadi", "Anzahl Würfel", "Nombre de dés", "Número de dados", "Número de dados", "ダイスの数", "주사위 개수", "骰子数量", "عدد النرد"],
    "diceSides": ["Sides per die", "Facce del dado", "Seiten pro Würfel", "Faces par dé", "Caras por dado", "Faces por dado", "ダイスの面数", "주사위 면 수", "每个骰子的面数", "أوجه النرد"],
    "modifier": ["Modifier", "Modificatore", "Modifikator", "Modificateur", "Modificador", "Modificador", "修正値", "보정치", "调整值", "المعدل"],
    "rollLabel": ["Roll label", "Etichetta tiro", "Wurfbezeichnung", "Libellé du jet", "Etiqueta de tirada", "Rótulo da rolagem", "ロールの名前", "주사위 설명", "掷骰标签", "عنوان الرمية"],
    "rollDice": ["Roll dice", "Tira dadi", "Würfeln", "Lancer les dés", "Tirar dados", "Rolar dados", "ダイスをロール", "주사위 굴리기", "掷骰", "رمي النرد"],
    "condition": ["Condition", "Condizione", "Zustand", "État", "Estado", "Condição", "状態", "상태", "状态", "الحالة"],
    "roundsDuration": ["Duration in rounds (0 = manual)", "Durata in round (0 = manuale)", "Dauer in Runden (0 = manuell)", "Durée en rounds (0 = manuelle)", "Duración en rondas (0 = manual)", "Duração em rodadas (0 = manual)", "持続ラウンド（0＝手動）", "지속 라운드 (0 = 수동)", "持续轮数（0＝手动）", "المدة بالجولات (0 = يدوي)"],
    "applyCondition": ["Apply condition", "Applica condizione", "Zustand anwenden", "Appliquer l’état", "Aplicar estado", "Aplicar condição", "状態を適用", "상태 적용", "应用状态", "تطبيق الحالة"],
    "startCombat": ["Prepare selected combatants", "Prepara combattenti selezionati", "Gewählte Kampfteilnehmer vorbereiten", "Préparer les combattants sélectionnés", "Preparar combatientes seleccionados", "Preparar combatentes selecionados", "選択した参加者を準備", "선택한 전투 참가자 준비", "准备所选参战者", "تجهيز المقاتلين المحددين"],
    "nextTurn": ["Begin / next turn", "Inizia / prossimo turno", "Beginnen / nächster Zug", "Commencer / tour suivant", "Iniciar / siguiente turno", "Iniciar / próximo turno", "開始／次のターン", "시작 / 다음 차례", "开始／下一回合", "بدء / الدور التالي"],
    "delayTurn": ["Delay current turn", "Ritarda turno attuale", "Aktuellen Zug verzögern", "Retarder le tour actuel", "Retrasar turno actual", "Adiar turno atual", "現在のターンを遅延", "현재 차례 지연", "延后当前回合", "تأخير الدور الحالي"],
    "addCombatant": ["Add selected token", "Aggiungi token selezionato", "Gewählte Figur hinzufügen", "Ajouter le pion sélectionné", "Añadir ficha seleccionada", "Adicionar peça selecionada", "選択したトークンを追加", "선택한 토큰 추가", "添加所选棋子", "إضافة الرمز المحدد"],
    "removeCombatant": ["Remove selected combatant", "Rimuovi combattente selezionato", "Gewählten Teilnehmer entfernen", "Retirer le combattant sélectionné", "Quitar combatiente seleccionado", "Remover combatente selecionado", "選択した参加者を除外", "선택한 전투 참가자 제거", "移除所选参战者", "إزالة المقاتل المحدد"],
    "endCombat": ["End combat", "Termina combattimento", "Kampf beenden", "Terminer le combat", "Terminar combate", "Encerrar combate", "戦闘を終了", "전투 종료", "结束战斗", "إنهاء القتال"],
    "conditions": ["Conditions", "Condizioni", "Zustände", "États", "Estados", "Condições", "状態", "상태", "状态", "الحالات"],
    "combatLog": ["Combat log", "Registro combattimento", "Kampfprotokoll", "Journal de combat", "Registro de combate", "Registro de combate", "戦闘ログ", "전투 기록", "战斗日志", "سجل القتال"],
    "combatRound": ["Round {round}", "Round {round}", "Runde {round}", "Round {round}", "Ronda {round}", "Rodada {round}", "ラウンド {round}", "라운드 {round}", "第{round}轮", "الجولة {round}"],
    "initiativePhase": ["Enter or roll initiative, resolve ties, then begin the first turn.", "Inserisci o tira iniziativa, risolvi i pareggi, poi inizia il primo turno.", "Initiative eingeben oder würfeln, Gleichstände klären und ersten Zug beginnen.", "Saisissez ou lancez l’initiative, départagez les égalités puis commencez le premier tour.", "Introduce o tira iniciativa, resuelve empates e inicia el primer turno.", "Insira ou role iniciativa, resolva empates e inicie o primeiro turno.", "イニシアチブを入力またはロールし、同値を解決して最初のターンを開始します。", "우선권을 입력하거나 굴리고 동점을 해결한 후 첫 차례를 시작하세요.", "输入或掷先攻，处理平局，然后开始首个回合。", "أدخل أو ارمِ المبادرة، احسم التعادل، ثم ابدأ الدور الأول."],
    "combatEmpty": ["No active combat. The GM can select tokens to prepare it.", "Nessun combattimento attivo. Il GM può selezionare i token per prepararlo.", "Kein aktiver Kampf. Die Spielleitung kann Figuren auswählen.", "Aucun combat actif. Le MJ peut sélectionner des pions pour le préparer.", "No hay combate activo. El DJ puede seleccionar fichas para prepararlo.", "Nenhum combate ativo. O mestre pode selecionar peças para prepará-lo.", "戦闘は開始されていません。GMはトークンを選択して準備できます。", "진행 중인 전투가 없습니다. GM이 토큰을 선택해 준비할 수 있습니다.", "当前没有战斗。主持人可以选择棋子进行准备。", "لا يوجد قتال نشط. يمكن لمدير اللعبة اختيار رموز لتجهيزه."],
    "moveEarlier": ["Earlier in order", "Anticipa nell’ordine", "In Reihenfolge nach vorn", "Avancer dans l’ordre", "Adelantar en el orden", "Adiantar na ordem", "順番を前に", "순서 앞당기기", "顺序提前", "تقديم في الترتيب"],
    "moveLater": ["Later in order", "Posticipa nell’ordine", "In Reihenfolge nach hinten", "Reculer dans l’ordre", "Retrasar en el orden", "Atrasar na ordem", "順番を後ろに", "순서 늦추기", "顺序延后", "تأخير في الترتيب"],
    "conditionExpired": ["Duration ended: review and remove explicitly", "Durata terminata: verifica e rimuovi esplicitamente", "Dauer abgelaufen: prüfen und ausdrücklich entfernen", "Durée écoulée : vérifier et retirer explicitement", "Duración terminada: revisar y quitar explícitamente", "Duração encerrada: revisar e remover explicitamente", "持続終了：確認して手動で解除", "지속 시간 종료: 확인 후 직접 제거", "持续时间结束：请检查并手动移除", "انتهت المدة: راجع وأزل صراحةً"],
    "condition.blinded": ["Blinded", "Accecato", "Blind", "Aveuglé", "Cegado", "Cego", "盲目", "실명", "目盲", "أعمى"],
    "condition.charmed": ["Charmed", "Affascinato", "Bezaubert", "Charmé", "Hechizado", "Enfeitiçado", "魅了", "매혹", "魅惑", "مسحور"],
    "condition.deafened": ["Deafened", "Assordato", "Taub", "Assourdi", "Ensordecido", "Surdo", "聴覚喪失", "귀먹음", "耳聋", "أصم"],
    "condition.frightened": ["Frightened", "Spaventato", "Verängstigt", "Effrayé", "Asustado", "Amedrontado", "恐怖", "공포", "恐慌", "خائف"],
    "condition.grappled": ["Grappled", "Afferrato", "Gepackt", "Agrippé", "Agarrado", "Agarrado", "つかまれた", "붙잡힘", "被擒抱", "ممسوك"],
    "condition.incapacitated": ["Incapacitated", "Incapacitato", "Kampfunfähig", "Neutralisé", "Incapacitado", "Incapacitado", "無力", "행동 불능", "失能", "عاجز"],
    "condition.invisible": ["Invisible", "Invisibile", "Unsichtbar", "Invisible", "Invisible", "Invisível", "不可視", "투명", "隐形", "غير مرئي"],
    "condition.paralyzed": ["Paralyzed", "Paralizzato", "Gelähmt", "Paralysé", "Paralizado", "Paralisado", "麻痺", "마비", "麻痹", "مشلول"],
    "condition.petrified": ["Petrified", "Pietrificato", "Versteinert", "Pétrifié", "Petrificado", "Petrificado", "石化", "석화", "石化", "متحجر"],
    "condition.poisoned": ["Poisoned", "Avvelenato", "Vergiftet", "Empoisonné", "Envenenado", "Envenenado", "毒", "중독", "中毒", "مسموم"],
    "condition.prone": ["Prone", "Prono", "Liegend", "À terre", "Derribado", "Caído", "伏せ", "넘어짐", "倒地", "منبطح"],
    "condition.restrained": ["Restrained", "Trattenuto", "Festgesetzt", "Entravé", "Restringido", "Impedido", "拘束", "구속", "束缚", "مقيد"],
    "condition.stunned": ["Stunned", "Stordito", "Betäubt", "Étourdi", "Aturdido", "Atordoado", "朦朧", "기절", "震慑", "مذهول"],
    "condition.unconscious": ["Unconscious", "Privo di sensi", "Bewusstlos", "Inconscient", "Inconsciente", "Inconsciente", "気絶", "의식 불명", "昏迷", "فاقد الوعي"],
    "condition.exhaustion": ["Exhaustion", "Indebolimento", "Erschöpfung", "Épuisement", "Agotamiento", "Exaustão", "消耗", "탈진", "力竭", "إرهاق"],
    "combatLog.start": ["Combat prepared", "Combattimento preparato", "Kampf vorbereitet", "Combat préparé", "Combate preparado", "Combate preparado", "戦闘準備完了", "전투 준비됨", "战斗已准备", "تم تجهيز القتال"],
    "combatLog.end": ["Combat ended", "Combattimento terminato", "Kampf beendet", "Combat terminé", "Combate terminado", "Combate encerrado", "戦闘終了", "전투 종료", "战斗已结束", "انتهى القتال"],
    "combatLog.turn": ["Turn begins", "Inizio turno", "Zug beginnt", "Début du tour", "Comienza el turno", "Início do turno", "ターン開始", "차례 시작", "回合开始", "بدء الدور"],
    "combatLog.delay": ["Turn delayed", "Turno ritardato", "Zug verzögert", "Tour retardé", "Turno retrasado", "Turno adiado", "ターン遅延", "차례 지연", "回合已延后", "تم تأخير الدور"],
    "combatLog.add": ["Combatant added", "Combattente aggiunto", "Teilnehmer hinzugefügt", "Combattant ajouté", "Combatiente añadido", "Combatente adicionado", "参加者追加", "전투 참가자 추가", "参战者已添加", "تمت إضافة مقاتل"],
    "combatLog.remove": ["Combatant removed", "Combattente rimosso", "Teilnehmer entfernt", "Combattant retiré", "Combatiente eliminado", "Combatente removido", "参加者除外", "전투 참가자 제거", "参战者已移除", "تمت إزالة مقاتل"],
    "combatLog.hp": ["HP changed", "PF modificati", "TP geändert", "PV modifiés", "PG cambiados", "PV alterados", "HP変更", "HP 변경", "生命值已更改", "تم تغيير نقاط الحياة"],
    "combatLog.initiative": ["Initiative", "Iniziativa", "Initiative", "Initiative", "Iniciativa", "Iniciativa", "イニシアチブ", "우선권", "先攻", "المبادرة"],
    "combatLog.condition": ["Condition applied", "Condizione applicata", "Zustand angewendet", "État appliqué", "Estado aplicado", "Condição aplicada", "状態適用", "상태 적용", "状态已应用", "تم تطبيق الحالة"],
    "combatLog.conditionRemoved": ["Condition removed", "Condizione rimossa", "Zustand entfernt", "État retiré", "Estado quitado", "Condição removida", "状態解除", "상태 제거", "状态已移除", "تمت إزالة الحالة"],
    "combatLog.roll": ["Dice roll", "Tiro di dadi", "Würfelwurf", "Jet de dés", "Tirada de dados", "Rolagem de dados", "ダイスロール", "주사위 굴림", "掷骰", "رمية نرد"],
    "combatLog.move": ["Token moved", "Token spostato", "Figur bewegt", "Pion déplacé", "Ficha movida", "Peça movida", "トークン移動", "토큰 이동", "棋子已移动", "تم تحريك الرمز"],
    tableAccessEnded: ["Table access ended. Return to your tables.","Accesso al tavolo terminato. Torna ai tuoi tavoli.","Tischzugang beendet. Kehre zu deinen Spieltischen zurück.","L’accès à la table a pris fin. Revenez à vos tables.","El acceso a la mesa terminó. Vuelve a tus mesas.","O acesso à mesa terminou. Volte às suas mesas.","卓へのアクセスが終了しました。卓の一覧に戻ってください。","테이블 접근이 종료되었습니다. 내 테이블로 돌아가세요.","游戏桌访问已结束。请返回游戏桌列表。","انتهى الوصول إلى الطاولة. ارجع إلى طاولاتك."],
    "shareTemplate": ["Share template", "Condividi sagoma", "Schablone teilen", "Partager le gabarit", "Compartir plantilla", "Compartilhar molde", "テンプレートを共有", "범위 공유", "共享范围", "مشاركة القالب"],
    "coverage": ["Cell coverage", "Copertura caselle", "Feldabdeckung", "Couverture des cases", "Cobertura de casillas", "Cobertura de casas", "マスの判定", "칸 포함 기준", "格子覆盖", "تغطية الخلايا"],
    "coverage.center": ["Cell centre inside", "Centro della casella interno", "Feldmitte innerhalb", "Centre de case inclus", "Centro de casilla dentro", "Centro da casa dentro", "マスの中心が内側", "칸 중심이 내부", "格子中心在内", "مركز الخلية بالداخل"],
    "coverage.touch": ["Conservative cell overlap", "Sovrapposizione prudenziale", "Großzügige Feldüberschneidung", "Chevauchement conservateur", "Solapamiento conservador", "Sobreposição conservadora", "余裕を含む重なり判定", "보수적인 칸 겹침", "保守重叠判定", "تداخل خلايا احترازي"],
    "board": ["Battle map", "Mappa di battaglia", "Kampfkarte", "Carte de combat", "Mapa de batalla", "Mapa de batalha", "戦闘マップ", "전투 지도", "战斗地图", "خريطة المعركة"],
    "boardKeys": ["Select a token below; move with arrow keys or position fields.", "Seleziona un token sotto; muovilo con le frecce o i campi posizione.", "Wähle unten eine Figur; bewege sie mit Pfeiltasten oder Positionsfeldern.", "Sélectionnez un pion ci-dessous ; déplacez-le avec les flèches ou les champs de position.", "Selecciona una ficha abajo; muévela con las flechas o los campos de posición.", "Selecione uma peça abaixo; mova com as setas ou os campos de posição.", "下でトークンを選択し、矢印キーまたは位置欄で移動します。", "아래에서 토큰을 선택하고 방향키나 위치 입력란으로 이동하세요.", "在下方选择棋子，用方向键或位置字段移动。", "اختر رمزًا أدناه؛ حرّكه بمفاتيح الأسهم أو حقول الموضع."],
    "boardFailed": ["Action failed. Your draft is kept. Refresh or retry.", "Operazione fallita. La bozza è conservata. Aggiorna o riprova.", "Aktion fehlgeschlagen. Entwurf bleibt erhalten. Aktualisiere oder versuche es erneut.", "Échec de l’action. Le brouillon est conservé. Actualisez ou réessayez.", "La acción falló. Se conserva el borrador. Actualiza o reintenta.", "A ação falhou. Rascunho preservado. Atualize ou tente novamente.", "操作に失敗しました。下書きは保持されています。更新または再試行してください。", "작업에 실패했습니다. 초안이 유지됩니다. 새로고침하거나 다시 시도하세요.", "操作失败。草稿已保留。请刷新或重试。", "فشل الإجراء. تم حفظ المسودة. حدّث أو أعد المحاولة."],
    "retry": ["Retry", "Riprova", "Erneut versuchen", "Réessayer", "Reintentar", "Tentar novamente", "再試行", "다시 시도", "重试", "إعادة المحاولة"],
    "scene": ["Scene", "Scena", "Szene", "Scène", "Escena", "Cena", "シーン", "장면", "场景", "المشهد"],
    "tool": ["Tool", "Strumento", "Werkzeug", "Outil", "Herramienta", "Ferramenta", "ツール", "도구", "工具", "الأداة"],
    "tool.move": ["Move", "Muovi", "Bewegen", "Déplacer", "Mover", "Mover", "移動", "이동", "移动", "تحريك"],
    "tool.ruler": ["Ruler", "Righello", "Lineal", "Règle", "Regla", "Régua", "定規", "자", "标尺", "مسطرة"],
    "tool.calibrate": ["Calibrate two cells", "Calibra due caselle", "Zwei Felder kalibrieren", "Calibrer deux cases", "Calibrar dos casillas", "Calibrar duas casas", "2マスを調整", "두 칸 보정", "校准两格", "معايرة خليتين"],
    "tool.terrain": ["Difficult terrain", "Terreno difficile", "Schwieriges Gelände", "Terrain difficile", "Terreno difícil", "Terreno difícil", "移動困難な地形", "험난한 지형", "困难地形", "تضاريس صعبة"],
    "tool.circle": ["Circle / sphere", "Cerchio / sfera", "Kreis / Kugel", "Cercle / sphère", "Círculo / esfera", "Círculo / esfera", "円／球", "원 / 구", "圆／球", "دائرة / كرة"],
    "tool.cone": ["Cone", "Cono", "Kegel", "Cône", "Cono", "Cone", "円錐", "원뿔", "锥形", "مخروط"],
    "tool.square": ["Square / cube", "Quadrato / cubo", "Quadrat / Würfel", "Carré / cube", "Cuadrado / cubo", "Quadrado / cubo", "正方形／立方体", "정사각형 / 정육면체", "方形／立方体", "مربع / مكعب"],
    "tool.line": ["Line", "Linea", "Linie", "Ligne", "Línea", "Linha", "直線", "선", "线", "خط"],
    "tool.cylinder": ["Cylinder", "Cilindro", "Zylinder", "Cylindre", "Cilindro", "Cilindro", "円柱", "원기둥", "柱形", "أسطوانة"],
    "templateSize": ["Template size", "Dimensione sagoma", "Schablonengröße", "Taille du gabarit", "Tamaño de plantilla", "Tamanho do molde", "テンプレートの大きさ", "범위 크기", "范围大小", "حجم القالب"],
    "primaryUnit": ["Primary unit", "Unità principale", "Haupteinheit", "Unité principale", "Unidad principal", "Unidade principal", "優先単位", "기본 단위", "首选单位", "الوحدة الأساسية"],
    "converter": ["Distance converter", "Convertitore distanze", "Entfernungsumrechner", "Conversion de distance", "Conversor de distancia", "Conversor de distância", "距離換算", "거리 변환", "距离换算", "محول المسافات"],
    "copyResult": ["Copy result", "Copia risultato", "Ergebnis kopieren", "Copier le résultat", "Copiar resultado", "Copiar resultado", "結果をコピー", "결과 복사", "复制结果", "نسخ النتيجة"],
    "conversion.table": ["Table convention: 5 ft = 1.5 m", "Convenzione del tavolo: 5 ft = 1,5 m", "Tischkonvention: 5 ft = 1,5 m", "Convention de table : 5 ft = 1,5 m", "Convención de mesa: 5 ft = 1,5 m", "Convenção da mesa: 5 ft = 1,5 m", "卓の換算：5 ft = 1.5 m", "테이블 환산: 5 ft = 1.5 m", "游戏约定：5 ft = 1.5 m", "اصطلاح الطاولة: 5 ft = 1.5 m"],
    "conversion.exact": ["Exact: 1 ft = 0.3048 m", "Esatta: 1 ft = 0,3048 m", "Exakt: 1 ft = 0,3048 m", "Exacte : 1 ft = 0,3048 m", "Exacta: 1 ft = 0,3048 m", "Exata: 1 ft = 0,3048 m", "正確：1 ft = 0.3048 m", "정확한 환산: 1 ft = 0.3048 m", "精确：1 ft = 0.3048 m", "دقيق: 1 ft = 0.3048 m"],
    "hidden": ["Hidden", "Nascosto", "Verborgen", "Masqué", "Oculto", "Oculto", "非表示", "숨김", "隐藏", "مخفي"],
    "sceneEmpty": ["The GM can create and activate a scene.", "Il GM può creare e attivare una scena.", "Die Spielleitung kann eine Szene erstellen und aktivieren.", "Le MJ peut créer et activer une scène.", "El DJ puede crear y activar una escena.", "O mestre pode criar e ativar uma cena.", "GMがシーンを作成して公開できます。", "GM이 장면을 만들고 활성화할 수 있습니다.", "主持人可以创建并激活场景。", "يمكن لمدير اللعبة إنشاء مشهد وتفعيله."],
    "gridScale": ["Distance per cell", "Distanza per casella", "Entfernung pro Feld", "Distance par case", "Distancia por casilla", "Distância por casa", "1マスの距離", "칸당 거리", "每格距离", "المسافة لكل خلية"],
    "pathLimit": ["Choose a path of at most 100 cells.", "Scegli un percorso di massimo 100 caselle.", "Wähle einen Weg mit höchstens 100 Feldern.", "Choisissez un trajet de 100 cases maximum.", "Elige una ruta de hasta 100 casillas.", "Escolha um trajeto de até 100 casas.", "経路は100マス以内にしてください。", "100칸 이내의 경로를 선택하세요.", "请选择不超过100格的路径。", "اختر مسارًا لا يتجاوز 100 خلية."],
    "positionX": ["Position X", "Posizione X", "Position X", "Position X", "Posición X", "Posição X", "X座標", "X 위치", "X坐标", "الموضع X"],
    "positionY": ["Position Y", "Posizione Y", "Position Y", "Position Y", "Posición Y", "Posição Y", "Y座標", "Y 위치", "Y坐标", "الموضع Y"],
    "sceneName": ["Scene name", "Nome scena", "Szenenname", "Nom de la scène", "Nombre de escena", "Nome da cena", "シーン名", "장면 이름", "场景名称", "اسم المشهد"],
    "mapWidth": ["Map width (px)", "Larghezza mappa (px)", "Kartenbreite (px)", "Largeur de carte (px)", "Ancho del mapa (px)", "Largura do mapa (px)", "マップの幅（px）", "지도 너비 (px)", "地图宽度（px）", "عرض الخريطة (px)"],
    "mapHeight": ["Map height (px)", "Altezza mappa (px)", "Kartenhöhe (px)", "Hauteur de carte (px)", "Alto del mapa (px)", "Altura do mapa (px)", "マップの高さ（px）", "지도 높이 (px)", "地图高度（px）", "ارتفاع الخريطة (px)"],
    "gridKind": ["Grid type", "Tipo griglia", "Rastertyp", "Type de grille", "Tipo de cuadrícula", "Tipo de grade", "グリッドの種類", "격자 종류", "网格类型", "نوع الشبكة"],
    "grid.square": ["Square", "Quadrata", "Quadratisch", "Carrée", "Cuadrada", "Quadrada", "正方形", "정사각형", "方格", "مربعة"],
    "grid.hexFlat": ["Hex, flat top", "Esagoni, lato in alto", "Hex, flache Oberseite", "Hexagones à sommet plat", "Hexágonos planos", "Hexágonos planos", "六角形（平辺上）", "육각형, 평평한 위쪽", "平顶六边形", "سداسية مسطحة الرأس"],
    "grid.hexPointy": ["Hex, pointy top", "Esagoni, vertice in alto", "Hex, Spitze oben", "Hexagones à sommet pointu", "Hexágonos en punta", "Hexágonos pontudos", "六角形（頂点上）", "육각형, 뾰족한 위쪽", "尖顶六边形", "سداسية مدببة الرأس"],
    "grid.none": ["No grid", "Senza griglia", "Ohne Raster", "Sans grille", "Sin cuadrícula", "Sem grade", "グリッドなし", "격자 없음", "无网格", "بلا شبكة"],
    "cellPixels": ["Cell size (px)", "Dimensione casella (px)", "Feldgröße (px)", "Taille de case (px)", "Tamaño de casilla (px)", "Tamanho da casa (px)", "マスの大きさ（px）", "칸 크기 (px)", "格子大小（px）", "حجم الخلية (px)"],
    "offsetX": ["Grid offset X (px)", "Scostamento griglia X (px)", "Rasterversatz X (px)", "Décalage X (px)", "Desplazamiento X (px)", "Deslocamento X (px)", "Xオフセット（px）", "X 격자 오프셋 (px)", "网格X偏移（px）", "إزاحة الشبكة X (px)"],
    "offsetY": ["Grid offset Y (px)", "Scostamento griglia Y (px)", "Rasterversatz Y (px)", "Décalage Y (px)", "Desplazamiento Y (px)", "Deslocamento Y (px)", "Yオフセット（px）", "Y 격자 오프셋 (px)", "网格Y偏移（px）", "إزاحة الشبكة Y (px)"],
    "units": ["Units", "Unità", "Einheiten", "Unités", "Unidades", "Unidades", "単位", "단위", "单位", "الوحدات"],
    "diagonal": ["Diagonal rule", "Regola diagonali", "Diagonalregel", "Règle diagonale", "Regla diagonal", "Regra diagonal", "斜め移動の規則", "대각선 규칙", "对角线规则", "قاعدة الحركة القطرية"],
    "diagonal.equal": ["Each cell counts once", "Ogni casella conta una volta", "Jedes Feld zählt einfach", "Chaque case compte une fois", "Cada casilla cuenta una vez", "Cada casa conta uma vez", "各マスを1回で計算", "각 칸을 한 번 계산", "每格计一次", "كل خلية تُحسب مرة"],
    "diagonal.alternating": ["Alternating 5/10", "Alternanza 5/10", "Abwechselnd 5/10", "Alternance 5/10", "Alternancia 5/10", "Alternância 5/10", "5/10交互", "5/10 번갈아 적용", "交替5/10", "بالتناوب 5/10"],
    "diagonal.euclidean": ["Euclidean distance", "Distanza euclidea", "Euklidische Entfernung", "Distance euclidienne", "Distancia euclídea", "Distância euclidiana", "ユークリッド距離", "유클리드 거리", "欧几里得距离", "المسافة الإقليدية"],
    "conversion": ["Conversion convention", "Convenzione di conversione", "Umrechnungskonvention", "Convention de conversion", "Convención de conversión", "Convenção de conversão", "換算方式", "환산 방식", "换算约定", "اصطلاح التحويل"],
    "gridColor": ["Grid colour", "Colore griglia", "Rasterfarbe", "Couleur de grille", "Color de cuadrícula", "Cor da grade", "グリッドの色", "격자 색상", "网格颜色", "لون الشبكة"],
    "opacity": ["Grid opacity (0–1)", "Opacità griglia (0–1)", "Rasterdeckkraft (0–1)", "Opacité de grille (0–1)", "Opacidad (0–1)", "Opacidade (0–1)", "不透明度（0–1）", "격자 불투명도 (0–1)", "网格不透明度（0–1）", "عتامة الشبكة (0–1)"],
    "freeMove": ["Allow movement outside combat", "Consenti movimento fuori combattimento", "Bewegung außerhalb des Kampfes erlauben", "Autoriser le déplacement hors combat", "Permitir movimiento fuera de combate", "Permitir movimento fora de combate", "戦闘外の移動を許可", "전투 외 이동 허용", "允许战斗外移动", "السماح بالحركة خارج القتال"],
    "editScene": ["Edit selected scene", "Modifica scena selezionata", "Gewählte Szene bearbeiten", "Modifier la scène sélectionnée", "Editar escena seleccionada", "Editar cena selecionada", "選択したシーンを編集", "선택한 장면 편집", "编辑所选场景", "تحرير المشهد المحدد"],
    "newScene": ["New scene", "Nuova scena", "Neue Szene", "Nouvelle scène", "Nueva escena", "Nova cena", "新規シーン", "새 장면", "新场景", "مشهد جديد"],
    "saveScene": ["Save scene", "Salva scena", "Szene speichern", "Enregistrer la scène", "Guardar escena", "Salvar cena", "シーンを保存", "장면 저장", "保存场景", "حفظ المشهد"],
    "activateScene": ["Show scene to players", "Mostra scena ai giocatori", "Szene den Spielern zeigen", "Montrer la scène aux joueurs", "Mostrar escena a jugadores", "Mostrar cena aos jogadores", "プレイヤーにシーンを公開", "플레이어에게 장면 공개", "向玩家展示场景", "عرض المشهد للاعبين"],
    "uploadMap": ["Upload map / Universal VTT", "Carica mappa / Universal VTT", "Karte / Universal VTT hochladen", "Importer une carte / Universal VTT", "Subir mapa / Universal VTT", "Enviar mapa / Universal VTT", "マップ／Universal VTTをアップロード", "지도 / Universal VTT 업로드", "上传地图／Universal VTT", "رفع خريطة / Universal VTT"],
    "mapReady": ["Image ready. Save the scene or token to use it.", "Immagine pronta. Salva la scena o il token per usarla.", "Bild bereit. Speichere die Szene oder Figur zur Verwendung.", "Image prête. Enregistrez la scène ou le pion pour l’utiliser.", "Imagen lista. Guarda la escena o ficha para usarla.", "Imagem pronta. Salve a cena ou peça para usar.", "画像の準備ができました。シーンまたはトークンを保存してください。", "이미지가 준비되었습니다. 사용하려면 장면이나 토큰을 저장하세요.", "图片已就绪。保存场景或棋子以使用。", "الصورة جاهزة. احفظ المشهد أو الرمز لاستخدامها."],
    "sceneEditor": ["Scene and grid", "Scena e griglia", "Szene und Raster", "Scène et grille", "Escena y cuadrícula", "Cena e grade", "シーンとグリッド", "장면과 격자", "场景与网格", "المشهد والشبكة"],
    "tokenName": ["Token name", "Nome token", "Figurenname", "Nom du pion", "Nombre de ficha", "Nome da peça", "トークン名", "토큰 이름", "棋子名称", "اسم الرمز"],
    "tokenOwner": ["Token owner", "Proprietario token", "Figurenbesitzer", "Propriétaire du pion", "Dueño de ficha", "Dono da peça", "トークン所有者", "토큰 소유자", "棋子所有者", "مالك الرمز"],
    "tokenSize": ["Token size (cells)", "Dimensione token (caselle)", "Figurengröße (Felder)", "Taille du pion (cases)", "Tamaño de ficha (casillas)", "Tamanho da peça (casas)", "トークンの大きさ（マス）", "토큰 크기 (칸)", "棋子大小（格）", "حجم الرمز (خلايا)"],
    "speed": ["Speed", "Velocità", "Geschwindigkeit", "Vitesse", "Velocidad", "Velocidade", "移動速度", "이동 속도", "速度", "السرعة"],
    "editToken": ["Edit selected token", "Modifica token selezionato", "Gewählte Figur bearbeiten", "Modifier le pion sélectionné", "Editar ficha seleccionada", "Editar peça selecionada", "選択したトークンを編集", "선택한 토큰 편집", "编辑所选棋子", "تحرير الرمز المحدد"],
    "newToken": ["New token", "Nuovo token", "Neue Figur", "Nouveau pion", "Nueva ficha", "Nova peça", "新規トークン", "새 토큰", "新棋子", "رمز جديد"],
    "portrait": ["Upload portrait", "Carica ritratto", "Porträt hochladen", "Importer un portrait", "Subir retrato", "Enviar retrato", "肖像をアップロード", "초상화 업로드", "上传肖像", "رفع صورة شخصية"],
    "saveToken": ["Save token", "Salva token", "Figur speichern", "Enregistrer le pion", "Guardar ficha", "Salvar peça", "トークンを保存", "토큰 저장", "保存棋子", "حفظ الرمز"],
    "removeTokenConfirm": ["Remove the selected token from this table?", "Rimuovere il token selezionato da questo tavolo?", "Die gewählte Figur von diesem Spieltisch entfernen?", "Retirer le pion sélectionné de cette table ?", "¿Quitar la ficha seleccionada de esta mesa?", "Remover a peça selecionada desta mesa?", "選択したトークンをこの卓から削除しますか？", "선택한 토큰을 이 테이블에서 제거할까요?", "要从此游戏桌移除所选棋子吗？", "هل تريد إزالة الرمز المحدد من هذه الطاولة؟"],
    "tokenEditor": ["Tokens", "Token", "Figuren", "Pions", "Fichas", "Peças", "トークン", "토큰", "棋子", "الرموز"],
    "nav.tables": ["Tables", "Tavoli", "Spieltische", "Tables de jeu", "Mesas", "Mesas", "卓", "테이블", "游戏桌", "الطاولات"],
    liveTitle: ["Table channel", "Canale del tavolo", "Spieltischkanal", "Canal de la table", "Canal de la mesa", "Canal da mesa", "卓のチャンネル", "테이블 채널", "游戏桌频道", "قناة الطاولة"],
    liveConnecting: ["Connecting…", "Connessione…", "Verbindung wird hergestellt…", "Connexion…", "Conectando…", "Conectando…", "接続中…", "연결 중…", "正在连接…", "جارٍ الاتصال…"],
    liveConnected: ["Live", "In diretta", "Verbunden", "En direct", "En vivo", "Ao vivo", "ライブ", "실시간", "实时", "مباشر"],
    liveReconnecting: ["Connection lost. Reconnecting…", "Connessione persa. Riconnessione…", "Verbindung verloren. Erneuter Versuch…", "Connexion perdue. Reconnexion…", "Conexión perdida. Reconectando…", "Conexão perdida. Reconectando…", "接続が切れました。再接続中…", "연결이 끊겼습니다. 다시 연결 중…", "连接已断开。正在重连…", "انقطع الاتصال. جارٍ إعادة الاتصال…"],
    liveOnline: ["{count} online", "{count} online", "{count} online", "{count} en ligne", "{count} en línea", "{count} online", "オンライン {count} 人", "온라인 {count}명", "{count} 人在线", "{count} متصلون"],
    liveMessage: ["Message to table", "Messaggio al tavolo", "Nachricht an den Spieltisch", "Message à la table", "Mensaje a la mesa", "Mensagem para a mesa", "卓へのメッセージ", "테이블 메시지", "发送到游戏桌的消息", "رسالة إلى الطاولة"],
    liveSend: ["Send", "Invia", "Senden", "Envoyer", "Enviar", "Enviar", "送信", "보내기", "发送", "إرسال"],
    liveSendFailed: ["Message not sent. Check the table and try again.", "Messaggio non inviato. Controlla il tavolo e riprova.", "Nachricht nicht gesendet. Prüfe den Spieltisch und versuche es erneut.", "Message non envoyé. Vérifiez la table et réessayez.", "Mensaje no enviado. Comprueba la mesa e inténtalo de nuevo.", "Mensagem não enviada. Confira a mesa e tente novamente.", "送信できませんでした。卓を確認して再試行してください。", "메시지를 보내지 못했습니다. 테이블을 확인하고 다시 시도하세요.", "消息未发送。请检查游戏桌后重试。", "لم تُرسل الرسالة. تحقق من الطاولة وحاول مجددًا."],
    tableSeats: ["At the table", "Al tavolo", "Am Spieltisch", "À la table", "En la mesa", "Na mesa", "卓の参加者", "테이블 참가자", "游戏桌成员", "على الطاولة"],
    tableRemove: ["Remove", "Rimuovi", "Entfernen", "Retirer", "Quitar", "Remover", "除外", "제거", "移除", "إزالة"],
    tableLeave: ["Leave table", "Lascia il tavolo", "Spieltisch verlassen", "Quitter la table", "Salir de la mesa", "Sair da mesa", "卓を退出", "테이블 나가기", "离开游戏桌", "مغادرة الطاولة"],
    tableRemoveConfirm: ["Remove {name} from this table?", "Rimuovere {name} da questo tavolo?", "{name} von diesem Spieltisch entfernen?", "Retirer {name} de cette table ?", "¿Quitar a {name} de esta mesa?", "Remover {name} desta mesa?", "{name} をこの卓から除外しますか？", "{name}님을 이 테이블에서 제거할까요?", "要将{name}移出此游戏桌吗？", "هل تريد إزالة {name} من هذه الطاولة؟"],
    tableLeaveConfirm: ["Leave this table? Your journal stays yours.", "Lasciare questo tavolo? Il tuo diario resta tuo.", "Diesen Spieltisch verlassen? Dein Journal bleibt erhalten.", "Quitter cette table ? Votre journal reste le vôtre.", "¿Salir de esta mesa? Tu diario seguirá siendo tuyo.", "Sair desta mesa? Seu diário continua sendo seu.", "この卓を退出しますか？日誌はそのまま残ります。", "이 테이블을 나가시겠어요? 일지는 그대로 남습니다.", "要离开此游戏桌吗？你的日志仍归你所有。", "هل تريد مغادرة الطاولة؟ ستبقى يومياتك ملكًا لك."],
    gmShared: ["Journal items shared with the GM", "Elementi del diario condivisi con il GM", "Mit der Spielleitung geteilte Journaleinträge", "Éléments du journal partagés avec le MJ", "Elementos del diario compartidos con el DJ", "Itens do diário compartilhados com o mestre", "GMと共有された日誌項目", "GM과 공유한 일지 항목", "与主持人共享的日志条目", "عناصر اليوميات المشتركة مع مدير اللعبة"],
    gmSharedEmpty: ["No journal items have been shared with this table's GM.", "Nessun elemento del diario è stato condiviso con il GM di questo tavolo.", "Es wurden keine Journaleinträge mit der Spielleitung geteilt.", "Aucun élément du journal n’a été partagé avec le MJ.", "No se ha compartido ningún elemento del diario con el DJ.", "Nenhum item do diário foi compartilhado com o mestre.", "この卓のGMと共有された日誌項目はありません。", "이 테이블의 GM과 공유된 일지 항목이 없습니다.", "没有与此游戏桌的主持人共享日志条目。", "لم تتم مشاركة أي عنصر من اليوميات مع مدير اللعبة."],
    tablesTitle: ["Your tables", "I tuoi tavoli", "Deine Spieltische", "Vos tables de jeu", "Tus mesas", "Suas mesas", "あなたの卓", "내 테이블", "你的游戏桌", "طاولاتك"],
    tablesEmpty: ["No tables yet. Create one or join with an invitation code.", "Ancora nessun tavolo. Creane uno o entra con un codice d’invito.", "Noch keine Spieltische. Erstelle einen oder tritt mit einem Einladungscode bei.", "Aucune table pour le moment. Créez-en une ou utilisez un code d’invitation.", "Aún no hay mesas. Crea una o únete con un código de invitación.", "Ainda não há mesas. Crie uma ou entre com um código de convite.", "まだ卓がありません。作成するか招待コードで参加してください。", "아직 테이블이 없습니다. 만들거나 초대 코드로 참가하세요.", "还没有游戏桌。创建一个或使用邀请码加入。", "لا توجد طاولات بعد. أنشئ واحدة أو انضم برمز دعوة."],
    createTable: ["Create table", "Crea tavolo", "Spieltisch erstellen", "Créer une table", "Crear mesa", "Criar mesa", "卓を作成", "테이블 만들기", "创建游戏桌", "إنشاء طاولة"],
    tableName: ["Table name", "Nome del tavolo", "Name des Spieltischs", "Nom de la table", "Nombre de la mesa", "Nome da mesa", "卓の名前", "테이블 이름", "游戏桌名称", "اسم الطاولة"],
    joinTable: ["Join table", "Entra nel tavolo", "Spieltisch beitreten", "Rejoindre une table", "Unirse a una mesa", "Entrar na mesa", "卓に参加", "테이블 참가", "加入游戏桌", "الانضمام إلى طاولة"],
    inviteCode: ["Invitation code", "Codice d’invito", "Einladungscode", "Code d’invitation", "Código de invitación", "Código de convite", "招待コード", "초대 코드", "邀请码", "رمز الدعوة"],
    invitePlayer: ["Invite player", "Invita giocatore", "Spieler einladen", "Inviter un joueur", "Invitar jugador", "Convidar jogador", "プレイヤーを招待", "플레이어 초대", "邀请玩家", "دعوة لاعب"],
    inviteSpectator: ["Invite spectator", "Invita spettatore", "Zuschauer einladen", "Inviter un spectateur", "Invitar espectador", "Convidar espectador", "観戦者を招待", "관전자 초대", "邀请观众", "دعوة مشاهد"],
    copyInvite: ["Copy this one-use code now:", "Copia ora questo codice monouso:", "Diesen einmaligen Code jetzt kopieren:", "Copiez ce code à usage unique maintenant :", "Copia ahora este código de un solo uso:", "Copie agora este código de uso único:", "この一回限りのコードを今コピーしてください:", "이 일회용 코드를 지금 복사하세요:", "请立即复制此一次性代码：", "انسخ هذا الرمز المستخدم مرة واحدة الآن:"],
    "role.gm": ["GM", "GM", "Spielleitung", "MJ", "DJ", "Mestre", "GM", "GM", "主持人", "مدير اللعبة"],
    "role.spectator": ["Spectator", "Spettatore", "Zuschauer", "Spectateur", "Espectador", "Espectador", "観戦者", "관전자", "观众", "مشاهد"],
    skip: ["Skip to content", "Vai al contenuto", "Zum Inhalt springen", "Aller au contenu", "Ir al contenido", "Ir para o conteúdo", "本文へ移動", "본문으로 건너뛰기", "跳到内容", "انتقل إلى المحتوى"],
    sections: ["Sections", "Sezioni", "Bereiche", "Sections", "Secciones", "Seções", "セクション", "섹션", "栏目", "الأقسام"],
    language: ["Language", "Lingua", "Sprache", "Langue", "Idioma", "Idioma", "言語", "언어", "语言", "اللغة"],
    loading: ["Loading…", "Caricamento…", "Wird geladen…", "Chargement…", "Cargando…", "Carregando…", "読み込み中…", "불러오는 중…", "正在加载…", "جارٍ التحميل…"],
    cancel: ["Cancel", "Annulla", "Abbrechen", "Annuler", "Cancelar", "Cancelar", "キャンセル", "취소", "取消", "إلغاء"],
    never: ["never", "mai", "nie", "jamais", "nunca", "nunca", "なし", "없음", "从未", "أبدًا"],
    "role.owner": ["Owner", "Proprietario", "Besitzer", "Propriétaire", "Propietario", "Proprietário", "オーナー", "소유자", "所有者", "المالك"],
    "role.player": ["Player", "Giocatore", "Spieler", "Joueur", "Jugador", "Jogador", "プレイヤー", "플레이어", "玩家", "لاعب"],
    "role.reader": ["Reader", "Lettore", "Leser", "Lecteur", "Lector", "Leitor", "閲覧者", "열람자", "读者", "قارئ"],
    sessionEnded: ["Your session ended. Sign in again.", "La sessione è terminata. Accedi di nuovo.", "Deine Sitzung ist beendet. Melde dich erneut an.", "Votre session a pris fin. Reconnectez-vous.", "Tu sesión ha terminado. Inicia sesión de nuevo.", "Sua sessão terminou. Entre novamente.", "セッションが終了しました。もう一度サインインしてください。", "세션이 종료되었습니다. 다시 로그인하세요.", "你的会话已结束。请重新登录。", "انتهت جلستك. سجّل الدخول مرة أخرى."],
    requestFailed: ["Request failed (HTTP {status}).", "Richiesta non riuscita (HTTP {status}).", "Anfrage fehlgeschlagen (HTTP {status}).", "La requête a échoué (HTTP {status}).", "La solicitud falló (HTTP {status}).", "A solicitação falhou (HTTP {status}).", "リクエストに失敗しました (HTTP {status})。", "요청이 실패했습니다(HTTP {status}).", "请求失败 (HTTP {status})。", "فشل الطلب (HTTP {status})."],
    typeName: ["Type the exact name: {name}", "Scrivi il nome esatto: {name}", "Gib den genauen Namen ein: {name}", "Saisissez le nom exact : {name}", "Escribe el nombre exacto: {name}", "Digite o nome exato: {name}", "正確な名前を入力してください: {name}", "정확한 이름을 입력하세요: {name}", "请输入准确的名称：{name}", "اكتب الاسم بالضبط: {name}"],
    working: ["Working…", "In corso…", "Wird ausgeführt…", "En cours…", "Procesando…", "Processando…", "処理中…", "처리 중…", "正在处理…", "جارٍ التنفيذ…"],
    done: ["Done.", "Fatto.", "Erledigt.", "Terminé.", "Hecho.", "Concluído.", "完了しました。", "완료했습니다.", "已完成。", "تم."],
    "nav.campaigns": ["Campaigns", "Campagne", "Kampagnen", "Campagnes", "Campañas", "Campanhas", "キャンペーン", "캠페인", "战役", "الحملات"],
    "nav.devices": ["Devices", "Dispositivi", "Geräte", "Appareils", "Dispositivos", "Dispositivos", "デバイス", "기기", "设备", "الأجهزة"],
    "nav.operator": ["Operator", "Operatore", "Betreiber", "Opérateur", "Operador", "Operador", "運営者", "운영자", "运营者", "المشغّل"],
    signOutAs: ["Sign out ({name})", "Esci ({name})", "Abmelden ({name})", "Se déconnecter ({name})", "Cerrar sesión ({name})", "Sair ({name})", "サインアウト ({name})", "로그아웃({name})", "退出登录（{name}）", "تسجيل الخروج ({name})"],
    signIn: ["Sign in", "Accedi", "Anmelden", "Se connecter", "Iniciar sesión", "Entrar", "サインイン", "로그인", "登录", "تسجيل الدخول"],
    signedIn: ["Signed in.", "Accesso eseguito.", "Angemeldet.", "Connecté.", "Sesión iniciada.", "Sessão iniciada.", "サインインしました。", "로그인했습니다.", "已登录。", "تم تسجيل الدخول."],
    username: ["User name", "Nome utente", "Benutzername", "Nom d'utilisateur", "Nombre de usuario", "Nome de usuário", "ユーザー名", "사용자 이름", "用户名", "اسم المستخدم"],
    password: ["Password", "Password", "Passwort", "Mot de passe", "Contraseña", "Senha", "パスワード", "비밀번호", "密码", "كلمة المرور"],
    signInIntro: ["Manage your shared campaigns, members, invitations and devices. Writing notes happens in the Chronexus desktop app.", "Gestisci campagne condivise, membri, inviti e dispositivi. Le note si scrivono nell'app desktop Chronexus.", "Verwalte geteilte Kampagnen, Mitglieder, Einladungen und Geräte. Notizen schreibst du in der Chronexus-Desktop-App.", "Gérez vos campagnes partagées, membres, invitations et appareils. Les notes s'écrivent dans l'application de bureau Chronexus.", "Gestiona tus campañas compartidas, miembros, invitaciones y dispositivos. Las notas se escriben en la aplicación de escritorio Chronexus.", "Gerencie campanhas compartilhadas, membros, convites e dispositivos. As anotações são escritas no aplicativo de desktop Chronexus.", "共有キャンペーン、メンバー、招待、デバイスを管理します。メモは Chronexus デスクトップアプリで書きます。", "공유 캠페인, 멤버, 초대, 기기를 관리합니다. 메모 작성은 Chronexus 데스크톱 앱에서 합니다.", "管理共享战役、成员、邀请和设备。笔记在 Chronexus 桌面应用中编写。", "أدِر حملاتك المشتركة والأعضاء والدعوات والأجهزة. تُكتب الملاحظات في تطبيق Chronexus لسطح المكتب."],
    signInNote: ["The session is kept only in this browser tab and ends when you sign out or close it.", "La sessione resta solo in questa scheda del browser e termina quando esci o la chiudi.", "Die Sitzung bleibt nur in diesem Browser-Tab und endet beim Abmelden oder Schließen.", "La session n'existe que dans cet onglet et se termine à la déconnexion ou à sa fermeture.", "La sesión se guarda solo en esta pestaña y termina al cerrar sesión o cerrarla.", "A sessão fica apenas nesta aba do navegador e termina quando você sai ou a fecha.", "セッションはこのブラウザータブにのみ保持され、サインアウトまたはタブを閉じると終了します。", "세션은 이 브라우저 탭에만 유지되며 로그아웃하거나 탭을 닫으면 끝납니다.", "会话仅保存在此浏览器标签页中，退出登录或关闭标签页即结束。", "تُحفظ الجلسة في علامة التبويب هذه فقط وتنتهي عند تسجيل الخروج أو إغلاقها."],
    campaignsEmpty: ["No shared campaign yet. Create one from the Sharing view of a campaign in the desktop app, or join with an invitation.", "Ancora nessuna campagna condivisa. Creane una dalla vista Condivisione di una campagna nell'app desktop, oppure unisciti con un invito.", "Noch keine geteilte Kampagne. Erstelle eine in der Teilen-Ansicht einer Kampagne in der Desktop-App oder tritt mit einer Einladung bei.", "Aucune campagne partagée pour l'instant. Créez-en une depuis la vue Partage d'une campagne dans l'application de bureau, ou rejoignez-en une avec une invitation.", "Aún no hay campañas compartidas. Crea una desde la vista Compartir de una campaña en la aplicación de escritorio o únete con una invitación.", "Ainda não há campanhas compartilhadas. Crie uma na visão Compartilhamento de uma campanha no aplicativo de desktop ou entre com um convite.", "共有キャンペーンはまだありません。デスクトップアプリのキャンペーンの共有ビューから作成するか、招待で参加してください。", "아직 공유 캠페인이 없습니다. 데스크톱 앱에서 캠페인의 공유 보기로 만들거나 초대로 참여하세요.", "还没有共享战役。在桌面应用中某个战役的“共享”视图里创建，或通过邀请加入。", "لا توجد حملة مشتركة بعد. أنشئ واحدة من عرض المشاركة لحملة في تطبيق سطح المكتب، أو انضم بدعوة."],
    campaignsTitle: ["Your campaigns on this server", "Le tue campagne su questo server", "Deine Kampagnen auf diesem Server", "Vos campagnes sur ce serveur", "Tus campañas en este servidor", "Suas campanhas neste servidor", "このサーバー上のキャンペーン", "이 서버의 내 캠페인", "你在此服务器上的战役", "حملاتك على هذا الخادم"],
    campaignsNote: ["This page shows what the server holds. Changes a device has not sent yet are only known to that device.", "Questa pagina mostra ciò che il server conserva. Le modifiche non ancora inviate da un dispositivo le conosce solo quel dispositivo.", "Diese Seite zeigt, was der Server speichert. Noch nicht gesendete Änderungen kennt nur das jeweilige Gerät.", "Cette page montre ce que le serveur conserve. Les modifications qu'un appareil n'a pas encore envoyées ne sont connues que de cet appareil.", "Esta página muestra lo que guarda el servidor. Los cambios que un dispositivo aún no ha enviado solo los conoce ese dispositivo.", "Esta página mostra o que o servidor guarda. Alterações que um dispositivo ainda não enviou só são conhecidas por ele.", "このページはサーバーが保持している内容を表示します。デバイスが未送信の変更は、そのデバイスだけが把握しています。", "이 페이지는 서버가 보관한 내용을 보여 줍니다. 기기가 아직 보내지 않은 변경 사항은 그 기기만 압니다.", "此页面显示服务器保存的内容。设备尚未发送的更改只有该设备知道。", "تعرض هذه الصفحة ما يحتفظ به الخادم. التغييرات التي لم يرسلها جهاز بعد لا يعرفها إلا ذلك الجهاز."],
    backCampaigns: ["← Campaigns", "← Campagne", "← Kampagnen", "← Campagnes", "← Campañas", "← Campanhas", "← キャンペーン", "← 캠페인", "← 战役", "→ الحملات"],
    campaignMeta: ["Your role: {role} · {members} members · created {date}", "Il tuo ruolo: {role} · {members} membri · creata il {date}", "Deine Rolle: {role} · {members} Mitglieder · erstellt {date}", "Votre rôle : {role} · {members} membres · créée le {date}", "Tu rol: {role} · {members} miembros · creada el {date}", "Sua função: {role} · {members} membros · criada em {date}", "あなたの役割: {role} · メンバー {members} 人 · 作成 {date}", "내 역할: {role} · 멤버 {members}명 · 생성 {date}", "你的角色：{role} · {members} 名成员 · 创建于 {date}", "دورك: {role} · {members} أعضاء · أُنشئت في {date}"],
    keepTitle: ["What you keep on the server", "Cosa conservi sul server", "Was du auf dem Server speicherst", "Ce que vous conservez sur le serveur", "Lo que guardas en el servidor", "O que você guarda no servidor", "サーバーに保存している内容", "서버에 보관 중인 내용", "你在服务器上保存的内容", "ما تحتفظ به على الخادم"],
    statItems: ["your items", "i tuoi elementi", "deine Elemente", "vos éléments", "tus elementos", "seus itens", "自分の項目", "내 항목", "你的条目", "عناصرك"],
    statImages: ["your images here", "le tue immagini qui", "deine Bilder hier", "vos images ici", "tus imágenes aquí", "suas imagens aqui", "ここにある自分の画像", "여기 있는 내 이미지", "你在此的图片", "صورك هنا"],
    statLastSave: ["last save accepted", "ultimo salvataggio accettato", "letzte angenommene Speicherung", "dernier enregistrement accepté", "último guardado aceptado", "último salvamento aceito", "最後に受理された保存", "마지막으로 수락된 저장", "最近一次被接受的保存", "آخر حفظ مقبول"],
    statShared: ["items others share", "elementi condivisi da altri", "von anderen geteilte Elemente", "éléments partagés par d'autres", "elementos que comparten otros", "itens que outros compartilham", "他のメンバーが共有した項目", "다른 사람이 공유한 항목", "他人共享的条目", "عناصر يشاركها الآخرون"],
    kindsCaption: ["Your items by kind (server revisions)", "I tuoi elementi per tipo (revisioni sul server)", "Deine Elemente nach Art (Server-Revisionen)", "Vos éléments par type (révisions du serveur)", "Tus elementos por tipo (revisiones del servidor)", "Seus itens por tipo (revisões do servidor)", "種類別の自分の項目（サーバーのリビジョン）", "종류별 내 항목(서버 리비전)", "按类型列出的你的条目（服务器修订）", "عناصرك حسب النوع (مراجعات الخادم)"],
    thKind: ["Kind", "Tipo", "Art", "Type", "Tipo", "Tipo", "種類", "종류", "类型", "النوع"],
    thPrivate: ["Private copies", "Copie private", "Private Kopien", "Copies privées", "Copias privadas", "Cópias privadas", "非公開コピー", "비공개 사본", "私有副本", "نسخ خاصة"],
    thShared: ["Shared", "Condivisi", "Geteilt", "Partagés", "Compartidos", "Compartilhados", "共有", "공유됨", "已共享", "مشتركة"],
    thSize: ["Size", "Dimensione", "Größe", "Taille", "Tamaño", "Tamanho", "サイズ", "크기", "大小", "الحجم"],
    thRevision: ["Highest revision", "Revisione più alta", "Höchste Revision", "Révision la plus haute", "Revisión más alta", "Revisão mais alta", "最新リビジョン", "최고 리비전", "最高修订", "أعلى مراجعة"],
    kindsEmpty: ["You have not synchronized anything to this campaign.", "Non hai sincronizzato nulla in questa campagna.", "Du hast mit dieser Kampagne noch nichts synchronisiert.", "Vous n'avez rien synchronisé dans cette campagne.", "No has sincronizado nada en esta campaña.", "Você não sincronizou nada nesta campanha.", "このキャンペーンにはまだ何も同期していません。", "이 캠페인에 동기화한 항목이 없습니다.", "你尚未向此战役同步任何内容。", "لم تُزامن أي شيء مع هذه الحملة."],
    limits: ["The server cannot know changes still waiting on a device. Limits for the whole campaign: {items} items and {text} of text; {images} images and {imageBytes}; {account} of images per account (you use {used}).", "Il server non può conoscere le modifiche ancora in attesa su un dispositivo. Limiti per l'intera campagna: {items} elementi e {text} di testo; {images} immagini e {imageBytes}; {account} di immagini per account (ne usi {used}).", "Der Server kennt keine Änderungen, die noch auf einem Gerät warten. Grenzen der ganzen Kampagne: {items} Elemente und {text} Text; {images} Bilder und {imageBytes}; {account} Bilder pro Konto (du nutzt {used}).", "Le serveur ne peut pas connaître les modifications encore en attente sur un appareil. Limites de la campagne : {items} éléments et {text} de texte ; {images} images et {imageBytes} ; {account} d'images par compte (vous utilisez {used}).", "El servidor no puede conocer los cambios que aún esperan en un dispositivo. Límites de toda la campaña: {items} elementos y {text} de texto; {images} imágenes y {imageBytes}; {account} de imágenes por cuenta (usas {used}).", "O servidor não conhece alterações ainda pendentes em um dispositivo. Limites da campanha inteira: {items} itens e {text} de texto; {images} imagens e {imageBytes}; {account} de imagens por conta (você usa {used}).", "デバイスで送信待ちの変更はサーバーには分かりません。キャンペーン全体の上限: 項目 {items} 件・テキスト {text}、画像 {images} 枚・{imageBytes}、アカウントごとの画像 {account}（使用中 {used}）。", "서버는 기기에서 아직 대기 중인 변경 사항을 알 수 없습니다. 캠페인 전체 한도: 항목 {items}개와 텍스트 {text}, 이미지 {images}개와 {imageBytes}, 계정당 이미지 {account}(사용 중 {used}).", "服务器无法知道仍在设备上等待的更改。整个战役的上限：{items} 个条目和 {text} 文本；{images} 张图片和 {imageBytes}；每个账户 {account} 图片（你已使用 {used}）。", "لا يستطيع الخادم معرفة التغييرات التي ما زالت تنتظر على جهاز. حدود الحملة كلها: {items} عنصر و{text} من النص؛ {images} صورة و{imageBytes}؛ {account} من الصور لكل حساب (تستخدم {used})."],
    members: ["Members", "Membri", "Mitglieder", "Membres", "Miembros", "Membros", "メンバー", "멤버", "成员", "الأعضاء"],
    invitations: ["Invitations", "Inviti", "Einladungen", "Invitations", "Invitaciones", "Convites", "招待", "초대", "邀请", "الدعوات"],
    deletePanel: ["Delete", "Elimina", "Löschen", "Supprimer", "Eliminar", "Excluir", "削除", "삭제", "删除", "حذف"],
    leavePanel: ["Leave", "Abbandona", "Verlassen", "Quitter", "Abandonar", "Sair", "退出", "나가기", "退出", "مغادرة"],
    thName: ["Name", "Nome", "Name", "Nom", "Nombre", "Nome", "名前", "이름", "名称", "الاسم"],
    thRole: ["Role", "Ruolo", "Rolle", "Rôle", "Rol", "Função", "役割", "역할", "角色", "الدور"],
    thJoined: ["Joined", "Entrato", "Beigetreten", "Arrivée", "Unido", "Entrou", "参加日", "참여일", "加入时间", "تاريخ الانضمام"],
    thActions: ["Actions", "Azioni", "Aktionen", "Actions", "Acciones", "Ações", "操作", "작업", "操作", "الإجراءات"],
    you: [" (you)", " (tu)", " (du)", " (vous)", " (tú)", " (você)", "（あなた）", " (나)", "（你）", " (أنت)"],
    roleOf: ["Role of {name}", "Ruolo di {name}", "Rolle von {name}", "Rôle de {name}", "Rol de {name}", "Função de {name}", "{name} の役割", "{name}의 역할", "{name} 的角色", "دور {name}"],
    roleChanged: ["{name}: role changed to {role}.", "{name}: ruolo cambiato in {role}.", "{name}: Rolle geändert zu {role}.", "{name} : rôle changé en {role}.", "{name}: rol cambiado a {role}.", "{name}: função alterada para {role}.", "{name}: 役割を {role} に変更しました。", "{name}: 역할이 {role}(으)로 바뀌었습니다.", "{name}：角色已改为{role}。", "{name}: تغيّر الدور إلى {role}."],
    remove: ["Remove", "Rimuovi", "Entfernen", "Retirer", "Quitar", "Remover", "削除", "내보내기", "移除", "إزالة"],
    removeTitle: ["Remove {name}?", "Rimuovere {name}?", "{name} entfernen?", "Retirer {name} ?", "¿Quitar a {name}?", "Remover {name}?", "{name} を削除しますか?", "{name}을(를) 내보낼까요?", "移除 {name}？", "إزالة {name}؟"],
    removeP1: ["They lose access to this campaign. What they shared is withdrawn for everyone, and their devices clear what others shared at their next synchronization.", "Perde l'accesso a questa campagna. Ciò che aveva condiviso viene ritirato per tutti e i suoi dispositivi cancellano ciò che altri avevano condiviso alla sincronizzazione successiva.", "Die Person verliert den Zugang zu dieser Kampagne. Was sie geteilt hat, wird für alle zurückgezogen, und ihre Geräte löschen bei der nächsten Synchronisierung, was andere geteilt haben.", "Cette personne perd l'accès à la campagne. Ce qu'elle partageait est retiré pour tous, et ses appareils effacent ce que les autres partageaient à la prochaine synchronisation.", "Pierde el acceso a esta campaña. Lo que compartió se retira para todos y sus dispositivos borran lo que otros compartieron en la siguiente sincronización.", "A pessoa perde o acesso a esta campanha. O que ela compartilhou é retirado para todos, e os dispositivos dela apagam o que outros compartilharam na próxima sincronização.", "このキャンペーンへのアクセスを失います。その人が共有した内容は全員から取り下げられ、次の同期でその人のデバイスから他の人の共有内容が消去されます。", "이 캠페인에 대한 접근 권한을 잃습니다. 그 사람이 공유한 내용은 모두에게서 철회되고, 다음 동기화 때 그 사람의 기기에서 다른 사람이 공유한 내용이 지워집니다.", "此人将失去对该战役的访问权限。其共享的内容会对所有人撤回，其设备会在下次同步时清除他人共享的内容。", "يفقد هذا الشخص الوصول إلى الحملة. يُسحب ما شاركه من الجميع، وتمسح أجهزته ما شاركه الآخرون عند المزامنة التالية."],
    removeP2: ["They keep everything on their own computer. Devices that are offline learn it when they reconnect.", "Conserva tutto sul proprio computer. I dispositivi offline lo scoprono quando si riconnettono.", "Auf dem eigenen Computer bleibt alles erhalten. Geräte ohne Verbindung erfahren es beim nächsten Verbinden.", "Cette personne garde tout sur son ordinateur. Les appareils hors ligne l'apprennent à la reconnexion.", "Conserva todo en su propio ordenador. Los dispositivos sin conexión lo sabrán al reconectarse.", "A pessoa mantém tudo no próprio computador. Dispositivos offline ficam sabendo ao se reconectar.", "本人のコンピューター上のデータはすべて残ります。オフラインのデバイスは再接続時に反映されます。", "본인 컴퓨터에 있는 내용은 모두 유지됩니다. 오프라인 기기는 다시 연결될 때 반영됩니다.", "其本机上的内容全部保留。离线设备会在重新连接时得知。", "يحتفظ بكل شيء على حاسوبه. تعرف الأجهزة غير المتصلة بذلك عند إعادة الاتصال."],
    removed: ["{name} was removed.", "{name} è stato rimosso.", "{name} wurde entfernt.", "{name} a été retiré.", "{name} fue quitado.", "{name} foi removido.", "{name} を削除しました。", "{name}을(를) 내보냈습니다.", "已移除 {name}。", "تمت إزالة {name}."],
    loadingInvites: ["Loading invitations…", "Caricamento inviti…", "Einladungen werden geladen…", "Chargement des invitations…", "Cargando invitaciones…", "Carregando convites…", "招待を読み込み中…", "초대를 불러오는 중…", "正在加载邀请…", "جارٍ تحميل الدعوات…"],
    revoke: ["Revoke", "Revoca", "Widerrufen", "Révoquer", "Revocar", "Revogar", "取り消す", "취소", "撤销", "إبطال"],
    inviteRevoked: ["Invitation revoked.", "Invito revocato.", "Einladung widerrufen.", "Invitation révoquée.", "Invitación revocada.", "Convite revogado.", "招待を取り消しました。", "초대를 취소했습니다.", "邀请已撤销。", "أُبطلت الدعوة."],
    inviteLine: ["{role} · valid until {date} ", "{role} · valido fino al {date} ", "{role} · gültig bis {date} ", "{role} · valable jusqu'au {date} ", "{role} · válida hasta el {date} ", "{role} · válido até {date} ", "{role} · {date} まで有効 ", "{role} · {date}까지 유효 ", "{role} · 有效期至 {date} ", "{role} · صالحة حتى {date} "],
    noInvites: ["No pending invitation.", "Nessun invito in sospeso.", "Keine offenen Einladungen.", "Aucune invitation en attente.", "No hay invitaciones pendientes.", "Nenhum convite pendente.", "保留中の招待はありません。", "대기 중인 초대가 없습니다.", "没有待处理的邀请。", "لا توجد دعوات معلّقة."],
    invitePlayer: ["Invite a player", "Invita un giocatore", "Spieler einladen", "Inviter un joueur", "Invitar a un jugador", "Convidar um jogador", "プレイヤーを招待", "플레이어 초대", "邀请玩家", "دعوة لاعب"],
    inviteReader: ["Invite a reader", "Invita un lettore", "Leser einladen", "Inviter un lecteur", "Invitar a un lector", "Convidar um leitor", "閲覧者を招待", "열람자 초대", "邀请读者", "دعوة قارئ"],
    inviteCode: ["Invitation code for the role {role} (works once, until {date}): ", "Codice d'invito per il ruolo {role} (vale una volta, fino al {date}): ", "Einladungscode für die Rolle {role} (einmal gültig, bis {date}): ", "Code d'invitation pour le rôle {role} (utilisable une fois, jusqu'au {date}) : ", "Código de invitación para el rol {role} (válido una vez, hasta el {date}): ", "Código de convite para a função {role} (vale uma vez, até {date}): ", "役割 {role} の招待コード（1 回限り、{date} まで有効）: ", "{role} 역할 초대 코드(한 번만 사용 가능, {date}까지): ", "角色 {role} 的邀请码（仅可使用一次，有效期至 {date}）：", "رمز دعوة للدور {role} (يعمل مرة واحدة حتى {date}): "],
    inviteSecret: ["Send it privately; it is shown only now.", "Invialo in privato: viene mostrato solo ora.", "Sende ihn privat; er wird nur jetzt angezeigt.", "Envoyez-le en privé ; il n'est affiché que maintenant.", "Envíalo en privado; solo se muestra ahora.", "Envie em particular; ele só é mostrado agora.", "個別に送ってください。表示されるのは今だけです。", "비공개로 보내세요. 지금만 표시됩니다.", "请私下发送；它只在此时显示。", "أرسله بشكل خاص؛ لا يظهر إلا الآن."],
    inviteCreated: ["Invitation created.", "Invito creato.", "Einladung erstellt.", "Invitation créée.", "Invitación creada.", "Convite criado.", "招待を作成しました。", "초대를 만들었습니다.", "邀请已创建。", "أُنشئت الدعوة."],
    leaveButton: ["Leave the campaign", "Abbandona la campagna", "Kampagne verlassen", "Quitter la campagne", "Abandonar la campaña", "Sair da campanha", "キャンペーンから退出", "캠페인 나가기", "退出战役", "مغادرة الحملة"],
    leaveTitle: ["Leave this shared campaign?", "Abbandonare questa campagna condivisa?", "Diese geteilte Kampagne verlassen?", "Quitter cette campagne partagée ?", "¿Abandonar esta campaña compartida?", "Sair desta campanha compartilhada?", "この共有キャンペーンから退出しますか?", "이 공유 캠페인에서 나갈까요?", "退出此共享战役？", "مغادرة هذه الحملة المشتركة؟"],
    leaveP1: ["What the other players shared is cleared from your devices at their next synchronization, and the items you shared are withdrawn.", "Ciò che gli altri giocatori hanno condiviso viene cancellato dai tuoi dispositivi alla sincronizzazione successiva e gli elementi che hai condiviso vengono ritirati.", "Was die anderen geteilt haben, wird bei der nächsten Synchronisierung von deinen Geräten gelöscht, und deine geteilten Elemente werden zurückgezogen.", "Ce que les autres joueurs ont partagé est effacé de vos appareils à la prochaine synchronisation, et vos éléments partagés sont retirés.", "Lo que compartieron los demás se borra de tus dispositivos en la siguiente sincronización y se retiran los elementos que compartiste.", "O que os outros jogadores compartilharam é apagado dos seus dispositivos na próxima sincronização, e os itens que você compartilhou são retirados.", "他のプレイヤーが共有した内容は次の同期であなたのデバイスから消去され、あなたが共有した項目は取り下げられます。", "다른 플레이어가 공유한 내용은 다음 동기화 때 내 기기에서 지워지고, 내가 공유한 항목은 철회됩니다.", "其他玩家共享的内容会在下次同步时从你的设备清除，你共享的条目会被撤回。", "يُمسح ما شاركه اللاعبون الآخرون من أجهزتك عند المزامنة التالية، وتُسحب العناصر التي شاركتها."],
    leaveP2: ["Everything you wrote stays on your computer. You can join again only with a new invitation.", "Tutto ciò che hai scritto resta sul tuo computer. Puoi rientrare solo con un nuovo invito.", "Alles, was du geschrieben hast, bleibt auf deinem Computer. Beitreten kannst du nur mit einer neuen Einladung.", "Tout ce que vous avez écrit reste sur votre ordinateur. Vous ne pourrez revenir qu'avec une nouvelle invitation.", "Todo lo que escribiste se queda en tu ordenador. Solo podrás volver con una nueva invitación.", "Tudo o que você escreveu fica no seu computador. Só é possível voltar com um novo convite.", "書いた内容はすべてあなたのコンピューターに残ります。再参加には新しい招待が必要です。", "작성한 내용은 모두 내 컴퓨터에 남습니다. 다시 참여하려면 새 초대가 필요합니다.", "你写的所有内容都保留在你的电脑上。只有凭新邀请才能重新加入。", "يبقى كل ما كتبته على حاسوبك. لا يمكنك الانضمام مجددًا إلا بدعوة جديدة."],
    left: ["You left the campaign.", "Hai abbandonato la campagna.", "Du hast die Kampagne verlassen.", "Vous avez quitté la campagne.", "Has abandonado la campaña.", "Você saiu da campanha.", "キャンペーンから退出しました。", "캠페인에서 나갔습니다.", "你已退出战役。", "غادرت الحملة."],
    deleteButton: ["Delete the campaign on the server", "Elimina la campagna sul server", "Kampagne auf dem Server löschen", "Supprimer la campagne sur le serveur", "Eliminar la campaña del servidor", "Excluir a campanha no servidor", "サーバー上のキャンペーンを削除", "서버에서 캠페인 삭제", "删除服务器上的战役", "حذف الحملة من الخادم"],
    deleteTitle: ["Delete the campaign on the server?", "Eliminare la campagna sul server?", "Kampagne auf dem Server löschen?", "Supprimer la campagne sur le serveur ?", "¿Eliminar la campaña del servidor?", "Excluir a campanha no servidor?", "サーバー上のキャンペーンを削除しますか?", "서버에서 캠페인을 삭제할까요?", "删除服务器上的战役？", "حذف الحملة من الخادم؟"],
    deleteP1: ["Every private and shared copy, upload and invitation of this campaign is deleted on the server, for every member. It cannot be undone.", "Ogni copia privata e condivisa, caricamento e invito di questa campagna viene eliminato sul server, per tutti i membri. Non si può annullare.", "Alle privaten und geteilten Kopien, Uploads und Einladungen dieser Kampagne werden auf dem Server für alle Mitglieder gelöscht. Das lässt sich nicht rückgängig machen.", "Toutes les copies privées et partagées, envois et invitations de cette campagne sont supprimés sur le serveur, pour tous les membres. C'est irréversible.", "Se eliminan del servidor todas las copias privadas y compartidas, subidas e invitaciones de esta campaña, para todos los miembros. No se puede deshacer.", "Todas as cópias privadas e compartilhadas, envios e convites desta campanha são excluídos no servidor, para todos os membros. Não é possível desfazer.", "このキャンペーンの非公開・共有コピー、アップロード、招待はすべて、全メンバー分がサーバーから削除されます。元に戻せません。", "이 캠페인의 모든 비공개·공유 사본, 업로드, 초대가 모든 멤버에 대해 서버에서 삭제됩니다. 되돌릴 수 없습니다.", "此战役的所有私有和共享副本、上传内容和邀请都会为所有成员从服务器删除。无法撤销。", "تُحذف من الخادم كل النسخ الخاصة والمشتركة والملفات المرفوعة والدعوات لهذه الحملة، لكل الأعضاء. لا يمكن التراجع."],
    deleteP2: ["Each player keeps what is on their own computer. Server backups made earlier still contain the campaign until the operator removes them.", "Ogni giocatore conserva ciò che ha sul proprio computer. I backup del server fatti prima contengono ancora la campagna finché l'operatore non li rimuove.", "Jeder Spieler behält, was auf seinem Computer ist. Frühere Server-Sicherungen enthalten die Kampagne, bis der Betreiber sie entfernt.", "Chaque joueur garde ce qui est sur son ordinateur. Les sauvegardes du serveur faites auparavant contiennent la campagne jusqu'à ce que l'opérateur les supprime.", "Cada jugador conserva lo que tiene en su ordenador. Las copias de seguridad anteriores del servidor contienen la campaña hasta que el operador las elimine.", "Cada jogador mantém o que está no próprio computador. Backups anteriores do servidor ainda contêm a campanha até o operador removê-los.", "各プレイヤーは自分のコンピューター上のデータを保持します。以前に作成されたサーバーのバックアップには、運営者が削除するまでキャンペーンが残ります。", "각 플레이어는 자기 컴퓨터에 있는 내용을 유지합니다. 이전에 만든 서버 백업에는 운영자가 지울 때까지 캠페인이 남아 있습니다.", "每位玩家保留自己电脑上的内容。之前的服务器备份仍包含该战役，直到运营者删除它们。", "يحتفظ كل لاعب بما على حاسوبه. تبقى الحملة في نسخ الخادم الاحتياطية السابقة حتى يزيلها المشغّل."],
    deleteOk: ["Delete on the server", "Elimina sul server", "Auf dem Server löschen", "Supprimer sur le serveur", "Eliminar del servidor", "Excluir no servidor", "サーバーから削除", "서버에서 삭제", "从服务器删除", "حذف من الخادم"],
    deleted: ["Campaign deleted on the server.", "Campagna eliminata sul server.", "Kampagne auf dem Server gelöscht.", "Campagne supprimée sur le serveur.", "Campaña eliminada del servidor.", "Campanha excluída no servidor.", "サーバー上のキャンペーンを削除しました。", "서버에서 캠페인을 삭제했습니다.", "已从服务器删除战役。", "حُذفت الحملة من الخادم."],
    devicesTitle: ["Devices signed in", "Dispositivi connessi", "Angemeldete Geräte", "Appareils connectés", "Dispositivos con sesión iniciada", "Dispositivos conectados", "サインイン中のデバイス", "로그인된 기기", "已登录的设备", "الأجهزة المسجّل دخولها"],
    signOutHere: ["Sign out here", "Esci qui", "Hier abmelden", "Se déconnecter ici", "Cerrar sesión aquí", "Sair aqui", "ここでサインアウト", "여기서 로그아웃", "在此退出登录", "تسجيل الخروج هنا"],
    signOutDevice: ["Sign out this device", "Disconnetti questo dispositivo", "Dieses Gerät abmelden", "Déconnecter cet appareil", "Cerrar sesión en este dispositivo", "Desconectar este dispositivo", "このデバイスをサインアウト", "이 기기 로그아웃", "让此设备退出登录", "تسجيل خروج هذا الجهاز"],
    signedOut: ["Signed out.", "Disconnesso.", "Abgemeldet.", "Déconnecté.", "Sesión cerrada.", "Sessão encerrada.", "サインアウトしました。", "로그아웃했습니다.", "已退出登录。", "تم تسجيل الخروج."],
    deviceSignedOut: ["Device signed out.", "Dispositivo disconnesso.", "Gerät abgemeldet.", "Appareil déconnecté.", "Sesión del dispositivo cerrada.", "Dispositivo desconectado.", "デバイスをサインアウトしました。", "기기를 로그아웃했습니다.", "设备已退出登录。", "تم تسجيل خروج الجهاز."],
    thisBrowser: [" (this browser)", " (questo browser)", " (dieser Browser)", " (ce navigateur)", " (este navegador)", " (este navegador)", "（このブラウザー）", " (이 브라우저)", "（此浏览器）", " (هذا المتصفح)"],
    deviceLine: ["Last used {used} · expires {expires}", "Ultimo uso {used} · scade {expires}", "Zuletzt benutzt {used} · läuft ab {expires}", "Dernière utilisation {used} · expire {expires}", "Último uso {used} · caduca {expires}", "Último uso {used} · expira {expires}", "最終使用 {used} · 有効期限 {expires}", "마지막 사용 {used} · 만료 {expires}", "上次使用 {used} · 到期 {expires}", "آخر استخدام {used} · تنتهي {expires}"],
    devicesNote: ["A device signed out keeps its local data; it stops synchronizing until someone signs in there again.", "Un dispositivo disconnesso conserva i dati locali; smette di sincronizzare finché qualcuno non accede di nuovo.", "Ein abgemeldetes Gerät behält seine lokalen Daten; es synchronisiert erst wieder nach einer neuen Anmeldung.", "Un appareil déconnecté garde ses données locales ; il cesse de synchroniser jusqu'à une nouvelle connexion.", "Un dispositivo sin sesión conserva sus datos locales; deja de sincronizar hasta que alguien vuelva a iniciar sesión.", "Um dispositivo desconectado mantém seus dados locais; ele para de sincronizar até alguém entrar de novo.", "サインアウトしたデバイスはローカルデータを保持し、再度サインインするまで同期を停止します。", "로그아웃된 기기는 로컬 데이터를 유지하며, 다시 로그인할 때까지 동기화를 멈춥니다.", "已退出登录的设备保留本地数据，在重新登录前停止同步。", "يحتفظ الجهاز الذي سُجّل خروجه ببياناته المحلية، ويتوقف عن المزامنة حتى يسجّل أحد الدخول عليه مجددًا."],
    service: ["Service", "Servizio", "Dienst", "Service", "Servicio", "Serviço", "サービス", "서비스", "服务", "الخدمة"],
    operatorNote: ["The operator role shows service health and account metadata only. It grants no access to campaign content through this interface or the API.", "Il ruolo di operatore mostra solo lo stato del servizio e i metadati degli account. Non dà accesso ai contenuti delle campagne né da questa interfaccia né dall'API.", "Die Betreiberrolle zeigt nur Dienstzustand und Kontometadaten. Sie gewährt weder hier noch über die API Zugriff auf Kampagneninhalte.", "Le rôle d'opérateur ne montre que l'état du service et les métadonnées des comptes. Il ne donne aucun accès au contenu des campagnes, ni ici ni par l'API.", "El rol de operador solo muestra el estado del servicio y los metadatos de las cuentas. No da acceso al contenido de las campañas ni aquí ni mediante la API.", "A função de operador mostra apenas o estado do serviço e metadados das contas. Ela não dá acesso ao conteúdo das campanhas, nem aqui nem pela API.", "運営者ロールはサービスの状態とアカウントのメタデータのみを表示します。この画面でも API でもキャンペーンの内容にはアクセスできません。", "운영자 역할은 서비스 상태와 계정 메타데이터만 보여 줍니다. 이 화면이나 API로 캠페인 내용에 접근할 수 없습니다.", "运营者角色只显示服务状态和账户元数据，无论通过此界面还是 API 都无法访问战役内容。", "يعرض دور المشغّل حالة الخدمة وبيانات الحسابات الوصفية فقط، ولا يمنح أي وصول إلى محتوى الحملات عبر هذه الواجهة أو الواجهة البرمجية."],
    statVersion: ["server version", "versione del server", "Serverversion", "version du serveur", "versión del servidor", "versão do servidor", "サーバーバージョン", "서버 버전", "服务器版本", "إصدار الخادم"],
    statSchema: ["database schema", "schema del database", "Datenbankschema", "schéma de la base", "esquema de la base de datos", "esquema do banco de dados", "データベーススキーマ", "데이터베이스 스키마", "数据库架构", "مخطط قاعدة البيانات"],
    statDbSize: ["database size", "dimensione del database", "Datenbankgröße", "taille de la base", "tamaño de la base de datos", "tamanho do banco de dados", "データベースサイズ", "데이터베이스 크기", "数据库大小", "حجم قاعدة البيانات"],
    statAccounts: ["accounts", "account", "Konten", "comptes", "cuentas", "contas", "アカウント", "계정", "账户", "الحسابات"],
    statSessions: ["active sessions", "sessioni attive", "aktive Sitzungen", "sessions actives", "sesiones activas", "sessões ativas", "有効なセッション", "활성 세션", "活动会话", "الجلسات النشطة"],
    statCampaigns: ["campaigns", "campagne", "Kampagnen", "campagnes", "campañas", "campanhas", "キャンペーン", "캠페인", "战役", "الحملات"],
    statItemsStored: ["items stored", "elementi salvati", "gespeicherte Elemente", "éléments stockés", "elementos guardados", "itens armazenados", "保存済みの項目", "저장된 항목", "已存储条目", "العناصر المخزّنة"],
    statImagesStored: ["images stored", "immagini salvate", "gespeicherte Bilder", "images stockées", "imágenes guardadas", "imagens armazenadas", "保存済みの画像", "저장된 이미지", "已存储图片", "الصور المخزّنة"],
    statAi: ["server AI", "IA del server", "Server-KI", "IA du serveur", "IA del servidor", "IA do servidor", "サーバー AI", "서버 AI", "服务器 AI", "ذكاء الخادم الاصطناعي"],
    "ai.configured": ["configured", "configurata", "eingerichtet", "configurée", "configurada", "configurada", "設定済み", "구성됨", "已配置", "مُعدّ"],
    "ai.not installed": ["not installed", "non installata", "nicht installiert", "non installée", "no instalada", "não instalada", "未インストール", "설치되지 않음", "未安装", "غير مثبّت"],
    accounts: ["Accounts", "Account", "Konten", "Comptes", "Cuentas", "Contas", "アカウント", "계정", "账户", "الحسابات"],
    thUser: ["User", "Utente", "Benutzer", "Utilisateur", "Usuario", "Usuário", "ユーザー", "사용자", "用户", "المستخدم"],
    thCreated: ["Created", "Creato", "Erstellt", "Créé", "Creado", "Criado", "作成日", "생성일", "创建时间", "تاريخ الإنشاء"],
    thState: ["State", "Stato", "Status", "État", "Estado", "Estado", "状態", "상태", "状态", "الحالة"],
    thSessions: ["Sessions", "Sessioni", "Sitzungen", "Sessions", "Sesiones", "Sessões", "セッション", "세션", "会话", "الجلسات"],
    thCampaigns: ["Campaigns", "Campagne", "Kampagnen", "Campagnes", "Campañas", "Campanhas", "キャンペーン", "캠페인", "战役", "الحملات"],
    thStored: ["Stored", "Archiviato", "Gespeichert", "Stocké", "Guardado", "Armazenado", "保存量", "저장량", "已存储", "المخزّن"],
    "state.deleted": ["deleted", "eliminato", "gelöscht", "supprimé", "eliminado", "excluído", "削除済み", "삭제됨", "已删除", "محذوف"],
    "state.disabled": ["disabled", "disattivato", "deaktiviert", "désactivé", "desactivado", "desativado", "無効", "비활성화됨", "已停用", "معطّل"],
    "state.active": ["active", "attivo", "aktiv", "actif", "activo", "ativo", "有効", "활성", "活动", "نشط"],
    "kind.page": ["Codex pages", "Pagine del Codex", "Codex-Seiten", "Pages du Codex", "Páginas del Codex", "Páginas do Codex", "Codex ページ", "Codex 페이지", "Codex 页面", "صفحات Codex"],
    "kind.session": ["Sessions", "Sessioni", "Sitzungen", "Sessions", "Sesiones", "Sessões", "セッション", "세션", "场次", "الجلسات"],
    "kind.relationship": ["Relationships", "Relazioni", "Beziehungen", "Relations", "Relaciones", "Relações", "関係", "관계", "关系", "العلاقات"],
    "kind.party": ["Party", "Gruppo", "Gruppe", "Groupe", "Grupo", "Grupo", "パーティー", "파티", "队伍", "المجموعة"],
    "kind.clue": ["Clues", "Indizi", "Hinweise", "Indices", "Pistas", "Pistas", "手がかり", "단서", "线索", "الأدلة"],
    "kind.sheetSection": ["Sheet sections", "Sezioni della scheda", "Bogenabschnitte", "Sections de fiche", "Secciones de hoja", "Seções da ficha", "シートのセクション", "시트 섹션", "角色卡分区", "أقسام الورقة"],
    "kind.image": ["Images", "Immagini", "Bilder", "Images", "Imágenes", "Imagens", "画像", "이미지", "图片", "الصور"],
    "tool.pan": ["Pan view", "Sposta vista", "Ansicht verschieben", "Déplacer la vue", "Mover vista", "Mover visão", "表示を移動", "화면 이동", "平移视图", "تحريك العرض"],
    "tool.ping": ["Ping", "Segnala punto", "Punkt markieren", "Signaler un point", "Señalar punto", "Sinalizar ponto", "ピン", "핑", "标记位置", "إشارة"],
    "zoom": ["Zoom", "Zoom", "Zoom", "Zoom", "Zoom", "Zoom", "ズーム", "확대/축소", "缩放", "التكبير"],
    "zoomIn": ["Zoom in", "Ingrandisci", "Vergrößern", "Zoom avant", "Acercar", "Aproximar", "拡大", "확대", "放大", "تكبير"],
    "zoomOut": ["Zoom out", "Rimpicciolisci", "Verkleinern", "Zoom arrière", "Alejar", "Afastar", "縮小", "축소", "缩小", "تصغير"],
    "zoomFit": ["Fit map to view", "Adatta mappa alla vista", "Karte einpassen", "Ajuster la carte à la vue", "Ajustar mapa a la vista", "Ajustar mapa à visão", "マップを表示に合わせる", "지도를 화면에 맞춤", "地图适应视图", "ملاءمة الخريطة للعرض"],
    "fullscreen": ["Full screen", "Schermo intero", "Vollbild", "Plein écran", "Pantalla completa", "Tela cheia", "全画面", "전체 화면", "全屏", "ملء الشاشة"],
    "panels": ["Table panels", "Pannelli del tavolo", "Spieltisch-Bereiche", "Panneaux de la table", "Paneles de la mesa", "Painéis da mesa", "卓のパネル", "테이블 패널", "游戏桌面板", "لوحات الطاولة"],
    "pinged": ["{name} pinged the map", "{name} ha segnalato un punto", "{name} hat einen Punkt markiert", "{name} a signalé un point", "{name} señaló un punto", "{name} sinalizou um ponto", "{name} がマップにピンを打ちました", "{name} 님이 지도에 핑을 보냈습니다", "{name} 标记了地图位置", "أشار {name} إلى نقطة على الخريطة"],
    "tab.chat": ["Chat", "Chat", "Chat", "Discussion", "Chat", "Chat", "チャット", "채팅", "聊天", "الدردشة"],
    "tab.tokens": ["Tokens", "Segnalini", "Spielfiguren", "Pions", "Fichas", "Fichas", "コマ", "토큰", "棋子", "الرموز"],
    "tab.combat": ["Combat", "Combattimento", "Kampf", "Combat", "Combate", "Combate", "戦闘", "전투", "战斗", "القتال"],
    "tab.measure": ["Measure", "Misura", "Messen", "Mesure", "Medir", "Medir", "計測", "측정", "测量", "القياس"],
    "tab.scene": ["Scenes", "Scene", "Szenen", "Scènes", "Escenas", "Cenas", "シーン", "장면", "场景", "المشاهد"],
    "tab.fog": ["Fog", "Nebbia", "Nebel", "Brouillard", "Niebla", "Névoa", "霧", "안개", "迷雾", "الضباب"],
    "tab.library": ["Library", "Libreria", "Bibliothek", "Bibliothèque", "Biblioteca", "Biblioteca", "ライブラリ", "라이브러리", "资料库", "المكتبة"],
    "tab.players": ["Players", "Giocatori", "Spieler", "Joueurs", "Jugadores", "Jogadores", "プレイヤー", "플레이어", "玩家", "اللاعبون"],
    "tableCode": ["Table invitation code", "Codice d'invito al tavolo", "Einladungscode für den Spieltisch", "Code d'invitation à la table", "Código de invitación a la mesa", "Código de convite da mesa", "卓の招待コード", "테이블 초대 코드", "游戏桌邀请码", "رمز دعوة الطاولة"],
    "quickRolls": ["Quick rolls", "Tiri rapidi", "Schnellwürfe", "Jets rapides", "Tiradas rápidas", "Rolagens rápidas", "クイックロール", "빠른 굴림", "快速掷骰", "رميات سريعة"],
    "rollAdvantage": ["Advantage", "Vantaggio", "Vorteil", "Avantage", "Ventaja", "Vantagem", "有利", "이점", "优势", "أفضلية"],
    "rollDisadvantage": ["Disadvantage", "Svantaggio", "Nachteil", "Désavantage", "Desventaja", "Desvantagem", "不利", "불리", "劣势", "عيب"],
    "rollToGm": ["Only the GM sees my rolls", "Solo il GM vede i miei tiri", "Nur die SL sieht meine Würfe", "Seul le MJ voit mes jets", "Solo el DJ ve mis tiradas", "Só o mestre vê minhas rolagens", "GMにだけロールを見せる", "GM만 내 굴림을 봄", "仅GM可见我的掷骰", "مدير اللعبة فقط يرى رمياتي"],
    "chatHelp": ["Commands: /r 1d20+5 Attack · /r 2d20kh1 (advantage) · /gr 1d6 (only you and the GM) · /w gm message (whisper to the GM). The server rolls the dice.", "Comandi: /r 1d20+5 Attacco · /r 2d20kh1 (vantaggio) · /gr 1d6 (solo tu e il GM) · /w gm messaggio (sussurro al GM). I dadi li tira il server.", "Befehle: /r 1d20+5 Angriff · /r 2d20kh1 (Vorteil) · /gr 1d6 (nur du und die SL) · /w gm Nachricht (an die SL flüstern). Der Server würfelt.", "Commandes : /r 1d20+5 Attaque · /r 2d20kh1 (avantage) · /gr 1d6 (vous et le MJ seulement) · /w gm message (murmure au MJ). Le serveur lance les dés.", "Comandos: /r 1d20+5 Ataque · /r 2d20kh1 (ventaja) · /gr 1d6 (solo tú y el DJ) · /w gm mensaje (susurro al DJ). El servidor tira los dados.", "Comandos: /r 1d20+5 Ataque · /r 2d20kh1 (vantagem) · /gr 1d6 (só você e o mestre) · /w gm mensagem (sussurro ao mestre). O servidor rola os dados.", "コマンド: /r 1d20+5 攻撃 · /r 2d20kh1(有利)· /gr 1d6(自分とGMのみ)· /w gm メッセージ(GMへのささやき)。ダイスはサーバーが振ります。", "명령: /r 1d20+5 공격 · /r 2d20kh1 (이점) · /gr 1d6 (나와 GM만) · /w gm 메시지 (GM에게 귓속말). 주사위는 서버가 굴립니다.", "命令: /r 1d20+5 攻击 · /r 2d20kh1(优势)· /gr 1d6(仅你和GM)· /w gm 消息(私聊GM)。骰子由服务器掷出。", "الأوامر: ‎/r 1d20+5 هجوم · ‎/r 2d20kh1 (أفضلية) · ‎/gr 1d6 (أنت ومدير اللعبة فقط) · ‎/w gm رسالة (همس لمدير اللعبة). الخادم يرمي النرد."],
    "rollResult": ["rolled {expression}", "ha tirato {expression}", "würfelt {expression}", "lance {expression}", "tiró {expression}", "rolou {expression}", "{expression} をロール", "{expression} 굴림", "掷出 {expression}", "رمى {expression}"],
    "rollTotal": ["Total {total}", "Totale {total}", "Summe {total}", "Total {total}", "Total {total}", "Total {total}", "合計 {total}", "합계 {total}", "总计 {total}", "المجموع {total}"],
    "toGm": ["to the GM only", "solo per il GM", "nur an die SL", "au MJ seulement", "solo para el DJ", "só para o mestre", "GMのみ", "GM에게만", "仅GM可见", "لمدير اللعبة فقط"],
    "discardedDie": ["discarded", "scartato", "verworfen", "écarté", "descartado", "descartado", "除外", "제외됨", "舍弃", "مستبعد"],
    "chatEmpty": ["No messages yet. Say hello or roll a die.", "Ancora nessun messaggio. Saluta o tira un dado.", "Noch keine Nachrichten. Sag Hallo oder würfle.", "Aucun message pour l'instant. Dites bonjour ou lancez un dé.", "Aún no hay mensajes. Saluda o tira un dado.", "Ainda não há mensagens. Diga olá ou role um dado.", "まだメッセージはありません。挨拶するかダイスを振りましょう。", "아직 메시지가 없습니다. 인사하거나 주사위를 굴려 보세요.", "还没有消息。打个招呼或掷个骰子吧。", "لا توجد رسائل بعد. ألقِ التحية أو ارمِ نردًا."],
  };
  const STORE = "chronexus-web-locale";
  function supported(code) {
    if (!code) return null;
    const lower = code.toLowerCase();
    if (lower.startsWith("zh")) return "zh-Hans";
    if (lower.startsWith("pt")) return "pt-BR";
    return ORDER.find((c) => c.toLowerCase() === lower.split("-")[0]) ?? null;
  }
  function initial() {
    let saved = null;
    try { saved = localStorage.getItem(STORE); } catch { /* storage blocked */ }
    if (saved && ORDER.includes(saved)) return saved;
    for (const code of navigator.languages ?? [navigator.language]) {
      const match = supported(code);
      if (match) return match;
    }
    return "en";
  }
  let locale = initial();
  function apply() {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }
  function t(key, params = {}) {
    const row = M[key];
    const text = row ? (row[ORDER.indexOf(locale)] ?? row[0]) : key;
    return text.replace(/\{(\w+)\}/g, (all, name) => (name in params ? String(params[name]) : all));
  }
  function setLocale(code) {
    if (!ORDER.includes(code)) return;
    locale = code;
    try { localStorage.setItem(STORE, code); } catch { /* memory only */ }

  }

  window.ChronexusI18n = {
    t, setLocale, locales: LOCALES, has: (key) => key in M,
    get locale() { return locale; },
    // Used by the regression test: every row must have all ten translations.
    missing: () => Object.entries(M).filter(([, row]) => row.length !== ORDER.length || row.some((v) => !v)).map(([k]) => k),
  };
})();

// Explicit table-only combat controls. No roll writes HP or a character sheet.
(function(){
  const conditions=['blinded','charmed','deafened','frightened','grappled','incapacitated','invisible','paralyzed','petrified','poisoned','prone','restrained','stunned','unconscious','exhaustion'];
  function create({el,t,role,account,send,getBoard,getSelected,getScene,field,button,confirm}){
    const root=el('section',{class:'combat-tracker','aria-label':t('combat')}),heading=el('h2',{text:t('combat')}),round=el('p',{role:'status'}),roster=el('ol',{class:'combat-order'}),conditionList=el('ul',{class:'plain'}),logs=el('ol',{class:'combat-log'});
    const pick=el('select',{multiple:true,size:4,'aria-label':t('combatants')}),form=el('form',{onsubmit:e=>e.preventDefault()}),details=el('details',{},el('summary',{text:t('combatControls')}),form);
    const ownedButton=(key,fn)=>{const b=button(key,fn);b.setAttribute('data-owned-only','true');return b;};
    const act=action=>send({type:'combat',action});
    const selected=()=>getBoard()?.tokens.find(v=>v.id===getSelected());
    const mine=()=>selected()?.ownerId===account;
    const amount=field(form,'amount',1,'number'),hp=field(form,'hitPoints',0,'number'),maxHp=field(form,'maxHitPoints',0,'number'),ac=field(form,'armorClass',10,'number'),showHp=field(form,'showHitPoints',false,'checkbox');
    const tokenStatus=field(form,'tokenStatus','');
    const note=role==='gm'?field(form,'gmNote',''):null;
    form.append(ownedButton('loadVitals',()=>{const v=getBoard()?.vitals?.find(v=>v.tokenId===getSelected());if(!v||!mine())return;hp.value=v.hp??0;maxHp.value=v.maxHp??0;ac.value=v.ac??10;showHp.checked=v.showHp;tokenStatus.value=v.status??'';if(note)note.value=v.gmNote??'';}));
    const setVitals=async(delta=null)=>{const token=selected();if(!token||!mine())return;
      const previous=getBoard()?.vitals?.find(v=>v.tokenId===token.id);
      const value=delta===null?Number(hp.value):(previous?.hp??Number(hp.value))+delta;
      if(!await confirm(t('applyHitPoints'),[t('tokenOnly')],t('applyHitPoints')))return;
      return act({type:'setVitals',tokenId:token.id,hp:value,maxHp:delta===null?Number(maxHp.value):previous?.maxHp??Number(maxHp.value),ac:delta===null?Number(ac.value):previous?.ac??null,showHp:delta===null?showHp.checked:previous?.showHp??false,status:delta===null?tokenStatus.value:previous?.status??null,gmNote:role==='gm'?(delta===null?note.value:previous?.gmNote??null):null});
    };
    form.append(ownedButton('saveVitals',()=>setVitals()),ownedButton('damage',()=>setVitals(-Math.abs(Number(amount.value)))),ownedButton('healing',()=>setVitals(Math.abs(Number(amount.value)))));
    const initiative=field(form,'initiative',0,'number'),secret=role==='gm'?field(form,'secretRoll',false,'checkbox'):null;
    form.append(ownedButton('setInitiative',()=>mine()&&act({type:'initiative',tokenId:getSelected(),value:Number(initiative.value),roll:false,secret:secret?.checked??false})),ownedButton('rollInitiative',()=>mine()&&act({type:'initiative',tokenId:getSelected(),value:Number(initiative.value),roll:true,secret:secret?.checked??false})));
    const count=field(form,'diceCount',1,'number'),sides=field(form,'diceSides',20,'number'),modifier=field(form,'modifier',0,'number'),label=field(form,'rollLabel','');
    form.append(ownedButton('rollDice',()=>mine()&&act({type:'roll',tokenId:getSelected(),count:Number(count.value),sides:Number(sides.value),modifier:Number(modifier.value),secret:secret?.checked??false,label:label.value.trim()})));
    const condition=field(form,'condition','prone','text',conditions.map(v=>[v,t('condition.'+v)])),duration=field(form,'roundsDuration',1,'number');
    form.append(button('applyCondition',()=>selected()&&act({type:'setCondition',condition:{id:window.ChronexusBoard.id(),tokenId:getSelected(),name:condition.value,rounds:Number(duration.value)||null,expired:false}})));
    const gm=el('div',{class:'combat-actions'});
    if(role==='gm')gm.append(el('label',{},t('combatants'),pick),button('startCombat',()=>getScene()&&act({type:'start',sceneId:getScene().id,tokenIds:[...pick.selectedOptions].map(v=>v.value)})),button('nextTurn',()=>act({type:'next'})),button('delayTurn',()=>act({type:'delay'})),button('addCombatant',()=>selected()&&act({type:'add',tokenId:getSelected()})),button('removeCombatant',()=>selected()&&act({type:'remove',tokenId:getSelected()})),button('endCombat',async()=>{if(await confirm(t('endCombat'),[t('tokenOnly')],t('endCombat')))act({type:'end'});}));
    root.append(heading,round,gm,roster,el('h3',{text:t('conditions')}),conditionList,role==='spectator'?null:details,el('h3',{text:t('combatLog')}),logs,el('p',{class:'muted',text:t('tokenOnly')}));
    const fmt=v=>new Intl.NumberFormat(window.ChronexusI18n.locale).format(v);
    function update(value){
      const c=value.combat,scene=getScene();
      const chosen=new Set([...pick.selectedOptions].map(v=>v.value));pick.replaceChildren(...value.tokens.filter(v=>v.sceneId===scene?.id).map(v=>el('option',{value:v.id,selected:chosen.has(v.id),text:v.name})));
      round.textContent=c?.running?(c.round?t('combatRound',{round:fmt(c.round)}):t('initiativePhase')):t('combatEmpty');
      roster.replaceChildren(...(c?.order??[]).map((v,index)=>{
        const token=value.tokens.find(t=>t.id===v.tokenId),vitals=value.vitals?.find(t=>t.tokenId===v.tokenId),name=token?.name??'';
        const row=el('li',{'aria-current':c.current===v.tokenId?'step':undefined,class:c.current===v.tokenId?'current-turn':undefined},el('strong',{text:name}),el('span',{text:` · ${v.initiative===null?'—':fmt(v.initiative)}`}),vitals?.status?el('span',{text:' · '+vitals.status}):null,vitals?.hp===undefined?null:el('span',{text:` · ${t('hitPoints')}: ${fmt(vitals.hp)}/${fmt(vitals.maxHp)}`}));
        if(role==='gm'){
          const reorder=offset=>{const ids=c.order.map(v=>v.tokenId),other=index+offset;if(other<0||other>=ids.length)return;[ids[index],ids[other]]=[ids[other],ids[index]];act({type:'order',tokenIds:ids});};
          row.append(button('moveEarlier',()=>reorder(-1)),button('moveLater',()=>reorder(1)));
        }return row;
      }));
      conditionList.replaceChildren(...(c?.conditions??[]).map(v=>el('li',{},el('span',{text:`${value.tokens.find(t=>t.id===v.tokenId)?.name??''}: ${t('condition.'+v.name)}${v.rounds===null?'':` · ${t('combatRound',{round:fmt(v.rounds)})}`}${v.expired?' · '+t('conditionExpired'):''}`}),
        role==='gm'||value.tokens.find(t=>t.id===v.tokenId)?.ownerId===account?button('remove',()=>act({type:'removeCondition',conditionId:v.id})):null)));
      logs.replaceChildren(...(value.combatLog??[]).map(v=>el('li',{},el('strong',{text:t('combatLog.'+v.kind)}),document.createTextNode(` ${value.tokens.find(t=>t.id===v.tokenId)?.name??''}${v.amount===null?'':` · ${new Intl.NumberFormat(window.ChronexusI18n.locale).format(v.amount)}`}${v.dice.length?` [${v.dice.map(fmt).join(', ')}]`:''}${v.label?' · '+(conditions.includes(v.label)?t('condition.'+v.label):v.label):''}`))));
    }
    return{root,update};
  }
  window.ChronexusCombat={create};
})();

// Table-only canvas and keyboard controls. Server views are already audience-filtered.
(function () {
  const id = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    const millis = Date.now();
    for (let i = 0; i < 6; i++) bytes[i] = Math.floor(millis / 2 ** ((5 - i) * 8)) & 255;
    bytes[6] = (bytes[6] & 15) | 0x70; bytes[8] = (bytes[8] & 63) | 0x80;
    const h = [...bytes].map(n => n.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
  };
  const factor = convention => convention === 'exact' ? 0.3048 : 0.3;
  const convert = (value, from, to, convention) => from === to ? value : from === 'ft' ? value * factor(convention) : value / factor(convention);
  function pixel(p, g) {
    const s = g.pixels / 2;
    const [x,y] = g.kind === 'hexPointy' ? [Math.sqrt(3)*(p.x+p.y/2)*s, 1.5*p.y*s] :
      g.kind === 'hexFlat' ? [1.5*p.x*s, Math.sqrt(3)*(p.y+p.x/2)*s] :
      g.kind === 'none' ? [p.x,p.y] : [p.x*g.pixels,p.y*g.pixels];
    return {x:x+g.offset.x,y:y+g.offset.y};
  }
  function snap(p, g) {
    const x=p.x-g.offset.x,y=p.y-g.offset.y,s=g.pixels/2;
    if (g.kind === 'none') return {x,y};
    if (g.kind === 'square') return {x:Math.round(x/g.pixels),y:Math.round(y/g.pixels)};
    const q=g.kind==='hexPointy'?(Math.sqrt(3)*x/3-y/3)/s:2*x/3/s;
    const r=g.kind==='hexPointy'?2*y/3/s:(-x/3+Math.sqrt(3)*y/3)/s;
    let rx=Math.round(q),ry=Math.round(-q-r),rz=Math.round(r);
    const dx=Math.abs(rx-q),dy=Math.abs(ry+q+r),dz=Math.abs(rz-r);
    if (dx>dy&&dx>dz) rx=-ry-rz; else if(dy<=dz) rz=-rx-ry;
    return {x:rx,y:rz};
  }
  function path(from, to, g) {
    if(g.kind==='none') return [to];
    const count=g.kind==='square'?Math.max(Math.abs(to.x-from.x),Math.abs(to.y-from.y)):
      (Math.abs(to.x-from.x)+Math.abs(to.y-from.y)+Math.abs(to.x-from.x+to.y-from.y))/2;
    if(count>100) throw Error('pathLimit');
    return Array.from({length:count},(_,i)=>{
      const n=(i+1)/count,p={x:from.x+(to.x-from.x)*n,y:from.y+(to.y-from.y)*n};
      return g.kind==='square'?{x:Math.round(p.x),y:Math.round(p.y)}:snap(pixel(p,g),g);
    });
  }
  function cost(from, steps, scene, diagonals=0) {
    let value=0;
    for(const p of steps){const dx=Math.abs(p.x-from.x),dy=Math.abs(p.y-from.y),g=scene.grid;
      let cells;
      if(g.kind==='none') cells=Math.hypot(dx,dy)/g.pixels;
      else if(g.kind.startsWith('hex')) cells=(dx+dy+Math.abs(p.x-from.x+p.y-from.y))/2;
      else if(dx&&dy){diagonals++;cells=g.diagonal==='alternating'?(diagonals%2?1:2):g.diagonal==='euclidean'?Math.SQRT2:1;}
      else cells=Math.max(dx,dy);
      value+=cells*g.distance.value*(scene.difficult.some(q=>q.x===p.x&&q.y===p.y)?2:1);from=p;
    } return value;
  }
  function templateContains(p, area, g) {
    const origin=pixel(area.origin,g), cell=pixel(p,g), angle=area.angle*Math.PI/180;
    const dx=cell.x-origin.x,dy=cell.y-origin.y;
    const x=dx*Math.cos(angle)+dy*Math.sin(angle),y=-dx*Math.sin(angle)+dy*Math.cos(angle);
    const radius=convert(area.size.value,area.size.unit,g.distance.unit,g.conversion)/g.distance.value*g.pixels;
    // Centre coverage is exact. Touch coverage deliberately includes the cell's
    // bounding radius; the UI labels this conservative convention.
    const margin=area.coverage==='touch'?g.pixels/Math.SQRT2:0;
    if(area.shape==='circle'||area.shape==='cylinder')return Math.hypot(x,y)<=radius+margin;
    if(area.shape==='square')return x>=-margin&&x<=radius+margin&&Math.abs(y)<=radius/2+margin;
    if(area.shape==='line')return x>=-margin&&x<=radius+margin&&Math.abs(y)<=g.pixels/2+margin;
    return Math.hypot(x,y)<=radius+margin&&x>=-margin&&Math.abs(y)<=Math.max(0,x)*Math.tan(Math.PI/6)+margin;
  }
  // One 24 px stroke icon set, built with DOM calls (never markup strings). Decorative only:
  // every control also carries its translated name.
  const ICON={pan:'M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3',move:'M5 3l14 8-6 2-2 6z',ping:'M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18',ruler:'M3 17L17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2',calibrate:'M4 4h16v16H4zM12 4v16M4 12h16',terrain:'M3 20l6-10 4 6 3-4 5 8z',reveal:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6',cover:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM3 3l18 18',brushReveal:'M15 3l6 6-8 8-6-6zM7 11l-4 4v6h6l4-4',brushCover:'M15 3l6 6-8 8-6-6zM7 11l-4 4v6h6l4-4M3 3l18 18',polygon:'M12 3l9 7-3 11H6L3 10z',circle:'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18',cone:'M3 12l18-8v16z',square:'M4 4h16v16H4z',line:'M3 19L19 3M5 21L21 5',cylinder:'M5 6a7 3 0 1 0 14 0a7 3 0 1 0-14 0M5 6v12a7 3 0 0 0 14 0V6',zoomOut:'M5 12h14',zoomIn:'M5 12h14M12 5v14',zoomFit:'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',fullscreen:'M3 8V3h5M21 8V3h-5M3 16v5h5M21 16v5h-5M9 9h6v6H9z'};
  function icon(name){const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),path=document.createElementNS(ns,'path');
    for(const[k,v]of Object.entries({viewBox:'0 0 24 24',width:'22',height:'22','aria-hidden':'true',focusable:'false',class:'vtt-icon-svg'}))svg.setAttribute(k,v);
    path.setAttribute('d',ICON[name]);svg.append(path);return svg;}
  let instances=0;
  function create({el,t,api,tableId,role,account,seats,confirm,active,ping}) {
    const uid=++instances;
    const root=el('section',{class:'board-workspace vtt','aria-label':t('board')});
    const notice=el('p',{class:'note vtt-notice',role:'status',text:t('liveConnecting')});
    const status=el('div',{role:'status',class:'vtt-status'}), tools=el('div',{class:'board-tools'});
    const canvas=el('canvas',{class:'battle-map',width:1000,height:700,tabindex:0,'aria-label':t('boardKeys')});
    const summary=el('p',{class:'muted vtt-summary',text:t('boardKeys')});
    const pingStatus=el('p',{class:'sr-only','aria-live':'polite'});
    const roster=el('div',{class:'token-roster'}), editor=el('div',{class:'board-editor'});
    const sceneSelect=el('select',{'aria-label':t('scene')});
    const toolNames=['pan','move',...(role==='spectator'||!ping?[]:['ping']),'ruler',...(role==='gm'?['calibrate','terrain','reveal','cover','brushReveal','brushCover','polygon']:[]),'circle','cone','square','line','cylinder'];
    const tool={value:'move'};
    const palette=el('div',{class:'vtt-palette',role:'toolbar','aria-label':t('tool'),'aria-orientation':'vertical'});
    const toolButtons=toolNames.map(v=>el('button',{type:'button',class:'vtt-tool','data-tool':v,'aria-pressed':String(v===tool.value),title:t('tool.'+v),onclick:()=>chooseTool(v)},icon(v),el('span',{class:'sr-only',text:t('tool.'+v)})));
    palette.append(...toolButtons);
    palette.onkeydown=e=>{const i=toolButtons.indexOf(document.activeElement);if(i<0||!['ArrowUp','ArrowDown','Home','End'].includes(e.key))return;e.preventDefault();const n=e.key==='Home'?0:e.key==='End'?toolButtons.length-1:(i+(e.key==='ArrowDown'?1:-1)+toolButtons.length)%toolButtons.length;toolButtons[n].focus();};
    const stage=el('div',{class:'vtt-stage'},canvas);
    const viewport=el('div',{class:'vtt-viewport','data-tool':tool.value},stage);
    function chooseTool(v){if(!toolNames.includes(v))return;tool.value=v;if(v!=='polygon')polygon=[];measurement=['circle','cone','square','line','cylinder'].includes(v)?measurement:null;for(const b of toolButtons)b.setAttribute('aria-pressed',String(b.dataset.tool===v));viewport.dataset.tool=v;paint();}
    // View transform: CSS translate/scale on the stage. Pointer maths reads the transformed box.
    let view={x:0,y:0,z:1,fitted:null},panning=null,spaceHeld=false;
    const zoomLabel=el('output',{class:'vtt-zoom-level','aria-live':'off'});
    const applyView=()=>{stage.style.transform=`translate(${view.x}px,${view.y}px) scale(${view.z})`;zoomLabel.textContent=new Intl.NumberFormat(window.ChronexusI18n.locale,{style:'percent'}).format(view.z);};
    const fit=()=>{const s=scene();if(!s)return;const w=viewport.clientWidth||s.width,h=viewport.clientHeight||s.height;const z=Math.max(0.1,Math.min(4,w/s.width,h/s.height));view={x:(w-s.width*z)/2,y:(h-s.height*z)/2,z,fitted:s.id};applyView();};
    const zoomAt=(factor,cx=viewport.clientWidth/2,cy=viewport.clientHeight/2)=>{const z=Math.max(0.1,Math.min(4,view.z*factor));view.x=cx-(cx-view.x)*z/view.z;view.y=cy-(cy-view.y)*z/view.z;view.z=z;applyView();};
    viewport.addEventListener('wheel',e=>{if(!scene())return;e.preventDefault();const b=viewport.getBoundingClientRect();zoomAt(e.deltaY<0?1.15:1/1.15,e.clientX-b.left,e.clientY-b.top);},{passive:false});
    // Middle or right button, Space+drag and the pan tool move the view and never the map state.
    viewport.addEventListener('pointerdown',e=>{if(!(e.button===1||e.button===2||spaceHeld||tool.value==='pan'))return;e.stopPropagation();e.preventDefault();panning={id:e.pointerId,x:e.clientX,y:e.clientY,vx:view.x,vy:view.y};viewport.setPointerCapture?.(e.pointerId);viewport.classList.add('panning');},true);
    viewport.addEventListener('pointermove',e=>{if(!panning||e.pointerId!==panning.id)return;e.stopPropagation();view.x=panning.vx+e.clientX-panning.x;view.y=panning.vy+e.clientY-panning.y;applyView();},true);
    const endPan=e=>{if(!panning||e.pointerId!==panning.id)return;e.stopPropagation();panning=null;viewport.classList.remove('panning');};
    viewport.addEventListener('pointerup',endPan,true);viewport.addEventListener('pointercancel',endPan,true);
    viewport.addEventListener('contextmenu',e=>e.preventDefault());
    const zoomButton=(key,fn)=>el('button',{type:'button',class:'vtt-icon',title:t(key),'aria-label':t(key),onclick:fn},icon(key));
    const fullscreen=el('button',{type:'button',class:'vtt-icon',title:t('fullscreen'),'aria-label':t('fullscreen'),'aria-pressed':'false',onclick:()=>{try{if(document.fullscreenElement===root)document.exitFullscreen?.();else root.requestFullscreen?.();}catch{}}});
    fullscreen.append(icon('fullscreen'));document.addEventListener?.('fullscreenchange',()=>fullscreen.setAttribute('aria-pressed',String(document.fullscreenElement===root)));
    const zoomBar=el('div',{class:'vtt-zoom',role:'group','aria-label':t('zoom')},zoomButton('zoomOut',()=>zoomAt(1/1.25)),zoomLabel,zoomButton('zoomIn',()=>zoomAt(1.25)),zoomButton('zoomFit',fit),fullscreen);
    // Sidebar: one tab per panel; the host adds chat and players to the same list.
    const tabs=el('div',{class:'vtt-tabs',role:'tablist','aria-label':t('panels')}),panelsBox=el('div',{class:'vtt-panels'}),panelMap=new Map();
    let activePanel=null,savedPanel=null;try{savedPanel=localStorage.getItem('chronexus-table-panel');}catch{}
    function openPanel(key,remember=true){if(!panelMap.has(key))return;activePanel=key;for(const[k,v]of panelMap){const on=k===key;v.tab.setAttribute('aria-selected',String(on));v.tab.tabIndex=on?0:-1;v.body.hidden=!on;}if(remember)try{localStorage.setItem('chronexus-table-panel',key);}catch{}}
    function panel(key,first=false){
      if(panelMap.has(key))return panelMap.get(key).body;
      const tabId=`vtt-tab-${uid}-${key}`,panelId=`vtt-panel-${uid}-${key}`;
      const tab=el('button',{type:'button',role:'tab',id:tabId,'aria-controls':panelId,'aria-selected':'false',tabindex:'-1',text:t('tab.'+key),onclick:()=>openPanel(key)});
      const body=el('div',{role:'tabpanel',id:panelId,'aria-labelledby':tabId,class:'vtt-panel vtt-panel-'+key,tabindex:'0',hidden:true});
      if(first){tabs.prepend(tab);panelsBox.prepend(body);}else{tabs.append(tab);panelsBox.append(body);}
      panelMap.set(key,{tab,body});
      if(!activePanel||key===savedPanel||(first&&activePanel!==savedPanel))openPanel(key,false);
      return body;
    }
    tabs.onkeydown=e=>{const list=[...panelMap.keys()],i=list.indexOf(activePanel);if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key)||i<0)return;e.preventDefault();const rtl=getComputedStyle?.(tabs).direction==='rtl',forward=(e.key==='ArrowRight')!==rtl;const n=e.key==='Home'?0:e.key==='End'?list.length-1:(i+(forward?1:-1)+list.length)%list.length;openPanel(list[n]);panelMap.get(list[n]).tab.focus();};
    const sidebar=el('aside',{class:'vtt-sidebar','aria-label':t('panels')},tabs,panelsBox);
    panel('tokens');panel('combat');panel('measure');if(role==='gm'){panel('scene');panel('fog');panel('library');}
    // Pings are transient: drawn for a few seconds, announced politely, never stored.
    const pings=[];let pingFrame=0;
    function showPing(frame){const s=scene();if(!current()||!s||frame?.sceneId!==s.id||!Number.isFinite(frame.x)||!Number.isFinite(frame.y))return;pings.push({x:frame.x,y:frame.y,name:String(frame.authorName??'').slice(0,100),mine:frame.authorId===account,until:Date.now()+2500});if(pings.length>20)pings.shift();pingStatus.textContent=t('pinged',{name:String(frame.authorName??'').slice(0,100)});animate();}
    function animate(){if(pingFrame||!current())return;const next=globalThis.requestAnimationFrame??(fn=>setTimeout(fn,16));pingFrame=next(()=>{pingFrame=0;const now=Date.now();while(pings.length&&pings[0].until<now)pings.shift();paint();if(pings.length)animate();});}
    const sendPing=p=>{const s=scene();if(!ping||!online||role==='spectator'||!s||s.id!==board?.activeScene)return;try{ping({sceneId:s.id,x:Math.max(0,Math.min(s.width,p.x)),y:Math.max(0,Math.min(s.height,p.y))});}catch{}};
    const clone=value=>JSON.parse(JSON.stringify(value));
    let advanced=null,polygon=[],imageGeneration=0;
    let board=null,online=false,busy=false,disposed=false,selected=null,chosenScene=null,start=null,preview=null,measurement=null,calibration=null,pending=null,primary='ft';
    const images=new Map(),urls=new Set(),thumbUrls=new Set(),thumbnails=new Map();
    let thumbnailQueue=Promise.resolve();
    const thumbnailFor=assetId=>{if(!thumbnails.has(assetId)){const request=thumbnailQueue.then(async()=>{if(!current())return null;const blob=await api('GET',endpoint+'/maps/'+encodeURIComponent(assetId)+'/thumbnail',undefined,true);if(!current())return null;const url=URL.createObjectURL(blob);thumbUrls.add(url);return url;});thumbnailQueue=request.catch(()=>null);thumbnails.set(assetId,request);request.catch(()=>thumbnails.delete(assetId));}return thumbnails.get(assetId);};
    try{primary=localStorage.getItem('chronexus-table-unit')==='m'?'m':'ft';}catch{}
    const current=()=>!disposed&&active();
    const scene=()=>board?.scenes.find(s=>s.id===(chosenScene??board.activeScene))??board?.scenes[0];
    const tokens=()=>board?.tokens.filter(v=>v.sceneId===scene()?.id)??[];
    const selectedToken=()=>tokens().find(v=>v.id===selected);
    const number=v=>new Intl.NumberFormat(window.ChronexusI18n.locale,{maximumFractionDigits:2}).format(v);
    const distance=(v,unit=scene()?.grid.distance.unit??'ft',convention=scene()?.grid.conversion??'table')=>{
      const a=convert(v,unit,primary,convention), other=primary==='ft'?'m':'ft';
      return `${number(a)} ${primary} · ${number(convert(v,unit,other,convention))} ${other}`;
    };
    const button=(key,fn)=>{const b=el('button',{type:'button',text:t(key),onclick:fn,'data-board-write':true,disabled:!online||busy});return b;};
    const syncDisabled=()=>root.querySelectorAll('[data-board-write]').forEach(b=>b.disabled=!online||busy||(b.hasAttribute('data-owned-only')&&selectedToken()?.ownerId!==account));
    const showError=e=>{status.replaceChildren(el('p',{class:'error',role:'alert',text:t('boardFailed')}));if(pending)status.append(button('retry',()=>run(pending)));};
    const endpoint=`/api/v1/tables/${encodeURIComponent(tableId)}`;
    async function refresh(){const value=await api('GET',endpoint+'/board');if(current())update(value);}
    async function run(op) {
      if(!current()||!online||busy)return;
      busy=true;syncDisabled();pending=op;status.textContent=t('working');
      try{await api('POST',endpoint+'/board/operations',op);pending=null;await refresh();if(current())status.textContent=t('done');}
      catch(e){if(e.status===409||e.status===403||e.status===400){pending=null;try{await refresh();}catch{} }if(current())showError(e);}
      finally{busy=false;syncDisabled();}
    }
    const send=command=>run(pending??{operationId:id(),baseRevision:board.revision,command});
    function field(form,key,value,type='text',options) {
      const input=options?el('select',{},...options.map(([v,label])=>el('option',{value:v,text:label,selected:v===String(value)}))):el('input',{type,value,step:type==='number'?'any':undefined});
      input.id='board-'+key+'-'+id();form.append(el('label',{for:input.id,text:t(key)}),input);return input;
    }
    const read=input=>Number(input.value);
    const unitOptions=[['ft','ft'],['m','m']];
    const unit=el('select',{'aria-label':t('primaryUnit')},...unitOptions.map(([value,text])=>el('option',{value,text,selected:value===primary})));
    unit.onchange=()=>{primary=unit.value;try{localStorage.setItem('chronexus-table-unit',primary);}catch{}draw();};
    const converter=el('input',{type:'number',step:'any',value:30,'aria-label':t('converter')});
    const converted=el('output',{'aria-live':'polite'}),convention=el('span',{class:'muted'});
    const coverage=el('select',{'aria-label':t('coverage')},...['center','touch'].map(value=>el('option',{value,text:t('coverage.'+value)})));
    const templateSize=el('input',{type:'number',min:0,max:10000,value:15,step:'any','aria-label':t('templateSize')});
    const convertDisplay=()=>{converted.textContent=distance(Number(converter.value)||0,primary);convention.textContent=t('conversion.'+(scene()?.grid.conversion??'table'));};
    converter.oninput=convertDisplay;
    tools.append(coverage,el('label',{},t('templateSize'),templateSize),el('label',{},t('converter'),converter),converted,convention);
    sceneSelect.onchange=()=>{chosenScene=sceneSelect.value;selected=null;draw();tracker?.update(board);syncDisabled();};
    const copy=el('button',{type:'button',text:t('copyResult'),onclick:async()=>{try{await navigator.clipboard.writeText(converted.textContent);status.textContent=t('done');}catch{status.textContent=t('boardFailed');}}});tools.append(copy);
    if(role!=='spectator')tools.append(button('shareTemplate',()=>{if(measurement&&scene()&&role!=='spectator')send({type:'saveTemplate',template:measurement});}));
    const templateList=el('div',{class:'template-list'});
    const unitLabel=el('label',{class:'vtt-unit'},t('primaryUnit'),unit);
    root.append(el('h2',{class:'sr-only',text:t('board')}),el('div',{class:'vtt-topbar'},notice,sceneSelect,unitLabel,zoomBar),
      el('div',{class:'vtt-body'},palette,el('div',{class:'vtt-center board-stage'},viewport,summary,pingStatus,status),sidebar));
    panel('tokens').append(roster,editor);panel('measure').append(tools,templateList);
    async function loadImage(assetId){
      if(images.has(assetId))return;images.set(assetId,null);
      const generation=imageGeneration;
      try{const blob=await api('GET',endpoint+'/maps/'+encodeURIComponent(assetId),undefined,true);if(!current())return;
        if(generation!==imageGeneration)return;
        const url=URL.createObjectURL(blob);urls.add(url);const image=new Image();image.onload=()=>{if(current()&&generation===imageGeneration){images.set(assetId,image);draw();}};image.src=url;
      }catch{if(current()&&generation===imageGeneration){images.delete(assetId);status.textContent=t('boardFailed');}}
    }
    function draw(){
      if(!current())return;convertDisplay();const s=scene();
      sceneSelect.replaceChildren(...(board?.scenes??[]).map(v=>el('option',{value:v.id,selected:v.id===s?.id,text:v.name})));
      roster.replaceChildren(...tokens().map(v=>{
        const b=el('button',{type:'button','aria-pressed':v.id===selected,text:`${v.name} · ${distance(v.speed.value,v.speed.unit)}${v.hidden?' · '+t('hidden'):''}`,onclick:()=>{selected=v.id;draw();tracker?.update(board);syncDisabled();}});
        return el('div',{},b,el('span',{class:v.spent>convert(v.speed.value,v.speed.unit,s.grid.distance.unit,s.grid.conversion)?'error':'muted',text:distance(v.spent)+' / '+distance(v.speed.value,v.speed.unit)}));
      }));
      templateList.replaceChildren(...(board?.templates??[]).filter(v=>v.sceneId===s?.id).map(v=>el('div',{},t('tool.'+v.shape)+' '+distance(v.size.value,v.size.unit), (role==='gm'||v.ownerId===account)?button('remove',()=>send({type:'removeTemplate',templateId:v.id})):null)));
      if(!s){summary.textContent=t('sceneEmpty');return;}
      summary.textContent=t('boardKeys')+' '+t('gridScale')+': '+distance(s.grid.distance.value)+' · '+t('conversion.'+s.grid.conversion);
      paint();
    }
    function paint(){
      if(!current())return;const s=scene();if(!s)return;
      canvas.style.width=s.width+'px';canvas.style.height=s.height+'px';
      if(view.fitted!==s.id){view.fitted=s.id;(globalThis.requestAnimationFrame??setTimeout)(()=>{if(current())fit();});}
      const renderScale=Math.min(1,2048/s.width,2048/s.height);canvas.width=Math.round(s.width*renderScale);canvas.height=Math.round(s.height*renderScale);const ctx=canvas.getContext('2d');if(!ctx)return;ctx.scale(renderScale,renderScale);
      ctx.fillStyle='#292b28';ctx.fillRect(0,0,s.width,s.height);
      if(s.mapId){if(images.get(s.mapId))ctx.drawImage(images.get(s.mapId),0,0,s.width,s.height);else loadImage(s.mapId);}
      ctx.save();ctx.strokeStyle=s.grid.color;ctx.globalAlpha=s.grid.opacity;ctx.lineWidth=1;
      const g=s.grid;
      if(g.kind==='square'){ctx.beginPath();for(let x=((g.offset.x%g.pixels)+g.pixels)%g.pixels;x<s.width;x+=g.pixels){ctx.moveTo(x,0);ctx.lineTo(x,s.height);}for(let y=((g.offset.y%g.pixels)+g.pixels)%g.pixels;y<s.height;y+=g.pixels){ctx.moveTo(0,y);ctx.lineTo(s.width,y);}ctx.stroke();}
      else if(g.kind.startsWith('hex')){const radius=g.pixels/2;let n=0;for(let q=-256;q<512&&n<10000;q++)for(let r=-256;r<512&&n<10000;r++){const p=pixel({x:q,y:r},g);if(p.x<-radius||p.y<-radius||p.x>s.width+radius||p.y>s.height+radius)continue;n++;ctx.beginPath();for(let i=0;i<7;i++){const a=(i*60+(g.kind==='hexPointy'?30:0))*Math.PI/180;const x=p.x+radius*Math.cos(a),y=p.y+radius*Math.sin(a);i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();}}
      ctx.restore();ctx.fillStyle='rgba(160,100,40,0.4)';for(const p of s.difficult){const c=pixel(p,g);ctx.fillRect(c.x-g.pixels/2,c.y-g.pixels/2,g.pixels,g.pixels);}
      for(const v of tokens()){const p=pixel(v.position,g),r=v.size*g.pixels/2;
        if(v.artwork&&v.portraitId){const image=images.get(v.portraitId);if(image){const scale=Math.min(r*2/image.width,r*2/image.height);ctx.drawImage(image,p.x-image.width*scale/2,p.y-image.height*scale/2,image.width*scale,image.height*scale);if(v.id===selected){ctx.strokeStyle='#f6db8b';ctx.strokeRect(p.x-r,p.y-r,r*2,r*2);}}else loadImage(v.portraitId);continue;}
        ctx.beginPath();ctx.arc(p.x,p.y,r,0,2*Math.PI);ctx.fillStyle=v.hidden?'#736151':v.ownerId===account?'#245c68':'#803c39';ctx.fill();ctx.lineWidth=v.id===selected?4:2;ctx.strokeStyle=v.id===selected?'#f6db8b':'#f3e7cb';ctx.stroke();
        if(v.portraitId){const image=images.get(v.portraitId);if(image){ctx.save();ctx.beginPath();ctx.arc(p.x,p.y,r-2,0,2*Math.PI);ctx.clip();ctx.drawImage(image,p.x-r,p.y-r,r*2,r*2);ctx.restore();}else loadImage(v.portraitId);}
        ctx.font=`${Math.max(12,g.pixels/4)}px Georgia`;ctx.textAlign='center';ctx.fillStyle='#fff8e6';ctx.fillText(v.name,p.x,p.y+r+16);
        const effects=board?.combat?.conditions?.filter(c=>c.tokenId===v.id)??[];if(effects.length){ctx.beginPath();ctx.arc(p.x+r,p.y-r,12,0,Math.PI*2);ctx.fillStyle=effects.some(c=>c.expired)?'#b94d39':'#1f5f8b';ctx.fill();ctx.fillStyle='#ffffff';ctx.font='14px Georgia';ctx.fillText(number(effects.length),p.x+r,p.y-r+5);}
      }
      const areas=[...(board?.templates??[]).filter(a=>a.sceneId===s.id),...(measurement?[measurement]:[])];
      for(const area of areas){
        const a=pixel(area.origin,g),r=convert(area.size.value,area.size.unit,g.distance.unit,g.conversion)/g.distance.value*g.pixels;
        ctx.save();ctx.translate(a.x,a.y);ctx.rotate(area.angle*Math.PI/180);ctx.strokeStyle='#f6db8b';ctx.fillStyle='rgba(246,219,139,.16)';ctx.lineWidth=2;ctx.beginPath();
        if(['circle','cylinder'].includes(area.shape))ctx.arc(0,0,r,0,2*Math.PI);
        else if(area.shape==='cone'){ctx.moveTo(0,0);ctx.arc(0,0,r,-Math.PI/6,Math.PI/6);ctx.closePath();}
        else ctx.rect(0,-(area.shape==='line'?g.pixels:r)/2,r,area.shape==='line'?g.pixels:r);
        ctx.fill();ctx.stroke();ctx.restore();
        if(g.kind!=='none') {let count=0;const min=snap({x:Math.max(0,a.x-r-g.pixels),y:Math.max(0,a.y-r-g.pixels)},g),max=snap({x:Math.min(s.width,a.x+r+g.pixels),y:Math.min(s.height,a.y+r+g.pixels)},g);
          for(let x=Math.min(min.x,max.x)-2;x<=Math.max(min.x,max.x)+2&&count<10000;x++)for(let y=Math.min(min.y,max.y)-2;y<=Math.max(min.y,max.y)+2&&count<10000;y++){count++;if(!templateContains({x,y},area,g))continue;const c=pixel({x,y},g);ctx.fillStyle='rgba(246,219,139,.22)';ctx.fillRect(c.x-g.pixels/3,c.y-g.pixels/3,g.pixels*2/3,g.pixels*2/3);}}
      }
      if(preview&&start){const a=pixel(start,g),b=pixel(preview,g);ctx.beginPath();ctx.strokeStyle='#f6db8b';ctx.lineWidth=3;ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
        // Drag ghost: where the selected token would land. The server still validates the path.
        const v=selectedToken();if(tool.value==='move'&&movable(v)&&(preview.x!==start.x||preview.y!==start.y)){const r=v.size*g.pixels/2;ctx.save();ctx.globalAlpha=.55;ctx.beginPath();ctx.arc(b.x,b.y,r,0,2*Math.PI);ctx.fillStyle=v.ownerId===account?'#245c68':'#803c39';ctx.fill();ctx.setLineDash?.([6,4]);ctx.lineWidth=3;ctx.strokeStyle='#f6db8b';ctx.stroke();ctx.restore();ctx.font=`${Math.max(14,g.pixels/3.5)}px Georgia`;ctx.textAlign='center';ctx.fillStyle='#fff8e6';ctx.strokeStyle='#1b1712';ctx.lineWidth=4;ctx.strokeText?.(summary.textContent,b.x,b.y-r-10);ctx.fillText(summary.textContent,b.x,b.y-r-10);}}
      const fog=board?.fog?.find(f=>f.sceneId===s.id);
      if(fog){const visible=new Set(fog.visible);ctx.fillStyle=role==='gm'?'rgba(0,0,0,.55)':'#000';for(let y=0;y<fog.rows;y++)for(let x=0;x<fog.columns;x++)if(!visible.has(y*fog.columns+x))ctx.fillRect(x*s.width/fog.columns,y*s.height/fog.rows,Math.ceil(s.width/fog.columns),Math.ceil(s.height/fog.rows));}
      if(role==='gm'){const config=board?.fogEditor?.find(f=>f.sceneId===s.id);for(const w of config?.walls??[]){ctx.strokeStyle=w.open?'#4c9e84':w.door?'#dcb46d':'#e7d8b5';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(w.a.x,w.a.y);ctx.lineTo(w.b.x,w.b.y);ctx.stroke();}if(polygon.length){ctx.strokeStyle='#f6db8b';ctx.beginPath();polygon.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();}}
      const now=Date.now();
      for(const p of pings){const age=1-(p.until-now)/2500;ctx.save();ctx.strokeStyle=p.mine?'#7fd1e8':'#f6db8b';for(let ring=0;ring<3;ring++){const phase=(age*1.5+ring/3)%1;ctx.globalAlpha=Math.max(0,1-phase);ctx.lineWidth=4;ctx.beginPath();ctx.arc(p.x,p.y,g.pixels*(0.3+phase*1.6),0,2*Math.PI);ctx.stroke();}ctx.globalAlpha=1;ctx.font=`${Math.max(14,g.pixels/3.5)}px Georgia`;ctx.textAlign='center';ctx.fillStyle='#fff8e6';ctx.strokeStyle='#1b1712';ctx.lineWidth=4;ctx.strokeText?.(p.name,p.x,p.y-g.pixels);ctx.fillText(p.name,p.x,p.y-g.pixels);ctx.restore();}
    }
    const coordinate=e=>{const box=canvas.getBoundingClientRect();return {x:(e.clientX-box.left)*scene().width/box.width,y:(e.clientY-box.top)*scene().height/box.height};};
    const movable=v=>v&&(role==='gm'||v.ownerId===account)&&role!=='spectator';
    root.addEventListener('keydown',e=>{if(e.code==='Space'&&e.target===canvas){spaceHeld=true;e.preventDefault();}});
    root.addEventListener('keyup',e=>{if(e.code==='Space')spaceHeld=false;});
    canvas.onpointerdown=e=>{if(!scene())return;const p=coordinate(e);if(tool.value==='ping'||(e.altKey&&tool.value!=='polygon')){sendPing(p);return;}start=snap(p,scene().grid);preview=start;calibration=tool.value==='calibrate'?p:null;
      if(tool.value==='move'){const hit=tokens().findLast(v=>{const q=pixel(v.position,scene().grid);return Math.hypot(q.x-p.x,q.y-p.y)<v.size*scene().grid.pixels/2;});selected=hit?.id??selected;start=selectedToken()?.position??start;}
      if(role==='gm'&&['reveal','cover','brushReveal','brushCover'].includes(tool.value))calibration=p;
      if(role==='gm'&&tool.value==='polygon'){if(polygon.length<64)polygon.push(p);}
      canvas.setPointerCapture?.(e.pointerId);draw();tracker?.update(board);syncDisabled();};
    canvas.onpointercancel=()=>{start=null;preview=null;calibration=null;paint();};
    canvas.onpointermove=e=>{if(!start||!scene())return;preview=snap(coordinate(e),scene().grid);
      if(['circle','cone','square','line','cylinder'].includes(tool.value)){const a=pixel(start,scene().grid),b=pixel(preview,scene().grid);measurement={id:id(),sceneId:scene().id,ownerId:account,shape:tool.value,origin:start,angle:Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI,size:{value:Number(templateSize.value)||0,unit:primary},coverage:coverage.value,hidden:false};}
      try{summary.textContent=distance(cost(start,path(start,preview,scene().grid),scene(),selectedToken()?.diagonals??0));}catch{summary.textContent=t('pathLimit');}paint();};
    canvas.onpointerup=e=>{if(!start||!scene())return;const end=snap(coordinate(e),scene().grid),s=scene();
      if(tool.value==='move'&&movable(selectedToken())&&online){try{const steps=path(start,end,s.grid);if(steps.length)send({type:'move',tokenId:selected,path:steps});}catch{status.textContent=t('pathLimit');}}
      if(tool.value==='terrain'&&role==='gm'&&online){const cells=s.difficult.some(p=>p.x===end.x&&p.y===end.y)?s.difficult.filter(p=>p.x!==end.x||p.y!==end.y):[...s.difficult,end];send({type:'saveScene',scene:{...s,difficult:cells}});}
      if(tool.value==='calibrate'&&role==='gm'&&online){const a=calibration,b=coordinate(e),pixels=Math.abs(b.x-a.x)/2;if(pixels>=8)send({type:'saveScene',scene:{...s,grid:{...s.grid,pixels,offset:a}}});}
      if(role==='gm'&&online&&calibration&&['reveal','cover','brushReveal','brushCover'].includes(tool.value)){const b=coordinate(e),a=calibration;let points;
        if(tool.value.startsWith('brush')){const radius=Math.max(1,Number(advanced?.brush.value)||25);const angle=Math.atan2(b.y-a.y,b.x-a.x);points=[];for(let i=0;i<=12;i++){const v=angle-Math.PI/2+i*Math.PI/12;points.push({x:b.x+Math.cos(v)*radius,y:b.y+Math.sin(v)*radius});}for(let i=0;i<=12;i++){const v=angle+Math.PI/2+i*Math.PI/12;points.push({x:a.x+Math.cos(v)*radius,y:a.y+Math.sin(v)*radius});}}
        else points=[a,{x:b.x,y:a.y},b,{x:a.x,y:b.y}];
        points=points.map(p=>({x:Math.max(0,Math.min(s.width,p.x)),y:Math.max(0,Math.min(s.height,p.y))}));advanced?.paint(points,['reveal','brushReveal'].includes(tool.value));}
      start=null;calibration=null;if(tool.value==='move'||tool.value==='terrain'){preview=null;draw();}};
    canvas.onkeydown=e=>{
      if(e.key==='+'||e.key==='='){e.preventDefault();zoomAt(1.25);return;}
      if(e.key==='-'){e.preventDefault();zoomAt(1/1.25);return;}
      if(e.key==='0'){e.preventDefault();fit();return;}
      if((e.key==='p'||e.key==='P')&&scene()){const v=selectedToken();sendPing(v?pixel(v.position,scene().grid):{x:scene().width/2,y:scene().height/2});return;}
      if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)||!online||!movable(selectedToken()))return;e.preventDefault();const p={...selectedToken().position},step=scene().grid.kind==='none'?scene().grid.pixels:1;p.x+=e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0;p.y+=e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0;send({type:'move',tokenId:selected,path:[p]});};
    // Position fields provide a click/tap alternative to dragging and arrow keys.
    const moveForm=el('form',{onsubmit:e=>e.preventDefault()}),mx=field(moveForm,'positionX',0,'number'),my=field(moveForm,'positionY',0,'number');
    const moveButton=button('tool.move',()=>{const v=selectedToken();if(!movable(v))return;try{send({type:'move',tokenId:v.id,path:path(v.position,{x:read(mx),y:read(my)},scene().grid)});}catch{status.textContent=t('pathLimit');}});
    moveForm.append(moveButton);if(role!=='spectator')editor.append(moveForm);
    function sceneEditor(){
      const form=el('form',{onsubmit:e=>e.preventDefault()}),name=field(form,'sceneName',''),width=field(form,'mapWidth',1000,'number'),height=field(form,'mapHeight',700,'number');
      const kind=field(form,'gridKind','square','text',['square','hexFlat','hexPointy','none'].map(v=>[v,t('grid.'+v)]));
      const pixels=field(form,'cellPixels',50,'number'),ox=field(form,'offsetX',0,'number'),oy=field(form,'offsetY',0,'number');
      const scale=field(form,'gridScale',5,'number'),units=field(form,'units','ft','text',unitOptions);
      const diagonal=field(form,'diagonal','equal','text',['equal','alternating','euclidean'].map(v=>[v,t('diagonal.'+v)]));
      const convention=field(form,'conversion','table','text',['table','exact'].map(v=>[v,t('conversion.'+v)]));
      const color=field(form,'gridColor','#cab582','color'),opacity=field(form,'opacity',0.4,'number'),free=field(form,'freeMove',true,'checkbox');free.checked=true;
      let editing=null,mapId=null;
      form.append(button('editScene',()=>{const s=scene();if(!s)return;editing=s.id;mapId=s.mapId;name.value=s.name;width.value=s.width;height.value=s.height;kind.value=s.grid.kind;pixels.value=s.grid.pixels;ox.value=s.grid.offset.x;oy.value=s.grid.offset.y;scale.value=s.grid.distance.value;units.value=s.grid.distance.unit;diagonal.value=s.grid.diagonal;convention.value=s.grid.conversion;color.value=s.grid.color;opacity.value=s.grid.opacity;free.checked=s.freeMove;}));
      form.append(button('newScene',()=>{editing=null;mapId=null;name.value='';}));
      form.append(button('saveScene',()=>{const original=board?.scenes.find(s=>s.id===editing);return send({type:'saveScene',scene:{id:editing??id(),name:name.value.trim(),width:read(width),height:read(height),mapId,grid:{kind:kind.value,pixels:read(pixels),offset:{x:read(ox),y:read(oy)},color:color.value,opacity:read(opacity),distance:{value:read(scale),unit:units.value},diagonal:diagonal.value,conversion:convention.value},freeMove:free.checked,difficult:original?.difficult??[]}});}));
      form.append(button('activateScene',()=>scene()&&send({type:'activateScene',sceneId:scene().id})));
      const upload=field(form,'uploadMap','','file');upload.accept='image/png,image/jpeg,image/webp,.uvtt,.dd2vtt';
      form.append(button('uploadMap',async()=>{const file=upload.files?.[0];if(!file||busy)return;busy=true;syncDisabled();try{
        if(/\.(uvtt|dd2vtt)$/i.test(file.name)){if(file.size>46*1024*1024)throw Error();const document=JSON.parse(await file.text());await api('POST',endpoint+'/uvtt',{operationId:id(),baseRevision:board.revision,sceneId:id(),name:name.value.trim()||file.name,document});await refresh();}
        else{if(file.size>32*1024*1024)throw Error();const asset=await api('POST',endpoint+'/maps',file);mapId=asset.id;width.value=asset.width;height.value=asset.height;status.textContent=t('mapReady');}
      }catch(e){showError(e);}finally{busy=false;syncDisabled();}}));
      panel('scene').append(el('h3',{text:t('sceneEditor')}),form);
    }
    function tokenEditor(){
      const form=el('form',{onsubmit:e=>e.preventDefault()}),name=field(form,'tokenName',''),owner=field(form,'tokenOwner',account,'text',seats.filter(s=>s.role!=='spectator').map(s=>[s.accountId,s.displayName]));
      const x=field(form,'positionX',1,'number'),y=field(form,'positionY',1,'number'),size=field(form,'tokenSize',1,'number'),speed=field(form,'speed',30,'number'),units=field(form,'units','ft','text',unitOptions),hidden=field(form,'hidden',false,'checkbox');
      let editing=null,portraitId=null,artwork=false;
      form.append(button('editToken',()=>{const v=selectedToken();if(!v)return;editing=v.id;artwork=!!v.artwork;name.value=v.name;owner.value=v.ownerId;x.value=v.position.x;y.value=v.position.y;size.value=v.size;speed.value=v.speed.value;units.value=v.speed.unit;hidden.checked=v.hidden;portraitId=v.portraitId;}));
      form.append(button('newToken',()=>{editing=null;portraitId=null;artwork=false;name.value='';}));
      const portrait=field(form,'portrait','','file');portrait.accept='image/png,image/jpeg,image/webp';
      form.append(button('portrait',async()=>{const file=portrait.files?.[0];if(!file||file.size>32*1024*1024)return;try{portraitId=(await api('POST',endpoint+'/maps',file)).id;status.textContent=t('mapReady');}catch(e){showError(e);}}));
      form.append(button('saveToken',()=>scene()&&send({type:'saveToken',token:{id:editing??id(),sceneId:scene().id,ownerId:owner.value,name:name.value.trim(),position:{x:read(x),y:read(y)},size:read(size),speed:{value:read(speed),unit:units.value},hidden:hidden.checked,portraitId,characterId:null,spent:0,diagonals:0,artwork}})));
      form.append(button('remove',async()=>{if(selected&&await confirm(t('remove'),[t('removeTokenConfirm')],t('remove')))send({type:'removeToken',tokenId:selected});}));
      editor.append(el('details',{},el('summary',{text:t('tokenEditor')}),form));
    }
    function advancedEditor(){
      const section=(key,...nodes)=>{if(key==='fogEditor'){panel('fog').append(el('h3',{text:t(key)}),...nodes);return;}panel('library').append(el('details',{open:key==='monsterLibrary'},el('summary',{text:t(key)}),...nodes));};
      const form=()=>el('form',{onsubmit:e=>e.preventDefault()});
      const config=()=>clone(board?.fogEditor?.find(f=>f.sceneId===scene()?.id)??{sceneId:scene()?.id,enabled:true,vision:false,strokes:[],walls:[],eyes:[],lights:[]});
      const fogForm=form(),enabled=field(fogForm,'fogEnabled',true,'checkbox'),vision=field(fogForm,'visionEnabled',false,'checkbox'),brush=field(fogForm,'brushPixels',25,'number');enabled.checked=true;
      const saveFog=fog=>scene()&&send({type:'saveFog',fog});
      const paint=(points,reveal)=>{const f=config();f.enabled=true;f.strokes.push({points,reveal});return saveFog(f);};
      fogForm.append(button('save',()=>{const f=config();f.enabled=enabled.checked;f.vision=vision.checked;return saveFog(f);}),button('undoFog',()=>{const f=config();f.strokes.pop();return saveFog(f);}),button('finishPolygon',()=>{if(polygon.length>=3){const points=polygon;polygon=[];return paint(points,true);}}),button('cancel',()=>{polygon=[];draw();}),button('revealAll',()=>scene()&&paint([{x:0,y:0},{x:scene().width,y:0},{x:scene().width,y:scene().height},{x:0,y:scene().height}],true)),button('coverAll',async()=>{if(scene()&&await confirm(t('coverAll'),[t('coverAllConfirm')],t('coverAll'))){const f=config();f.enabled=true;f.strokes=[];return saveFog(f);}}));
      const x1=field(fogForm,'positionX',0,'number'),y1=field(fogForm,'positionY',0,'number'),x2=field(fogForm,'endX',100,'number'),y2=field(fogForm,'endY',100,'number'),door=field(fogForm,'door',false,'checkbox');
      fogForm.append(button('addWall',()=>{const f=config();f.walls.push({a:{x:read(x1),y:read(y1)},b:{x:read(x2),y:read(y2)},door:door.checked,open:false});return saveFog(f);}),button('revealRectangle',()=>paint([{x:read(x1),y:read(y1)},{x:read(x2),y:read(y1)},{x:read(x2),y:read(y2)},{x:read(x1),y:read(y2)}],true)));
      const range=field(fogForm,'visionRange',60,'number'),rangeUnit=field(fogForm,'units','ft','text',unitOptions),dark=field(fogForm,'darkvision',false,'checkbox'),rangeOutput=el('output');
      const rangeDisplay=()=>rangeOutput.textContent=distance(read(range),rangeUnit.value);range.oninput=rangeDisplay;rangeUnit.onchange=rangeDisplay;fogForm.append(rangeOutput);
      fogForm.append(button('setVision',()=>{const v=selectedToken();if(!v)return;const f=config();f.eyes=f.eyes.filter(e=>e.tokenId!==v.id);f.eyes.push({tokenId:v.id,range:{value:read(range),unit:rangeUnit.value},darkvision:dark.checked});return saveFog(f);}),button('addLight',()=>{const f=config();f.lights.push({position:{x:read(x1),y:read(y1)},range:{value:read(range),unit:rangeUnit.value}});return saveFog(f);}));
      fogForm.append(button('importGeometry',()=>scene()&&send({type:'importVision',sceneId:scene().id})));
      const walls=el('div'),lights=el('div'),eyes=el('div');section('fogEditor',el('p',{class:'muted',text:t('fogHelp')}),fogForm,walls,lights,eyes);
      const libraryForm=form(),name=field(libraryForm,'tokenName',''),hp=field(libraryForm,'hitPoints',1,'number'),ac=field(libraryForm,'armorClass',10,'number'),speed=field(libraryForm,'speed',30,'number'),size=field(libraryForm,'tokenSize',1,'number');
      const monsterUnit=field(libraryForm,'units','ft','text',unitOptions),monsterDistance=el('output');const showMonsterDistance=()=>monsterDistance.textContent=distance(read(speed),monsterUnit.value);speed.oninput=showMonsterDistance;monsterUnit.onchange=showMonsterDistance;libraryForm.append(monsterDistance);
      const stat=el('textarea',{rows:8,'aria-label':t('statBlock')}),sourceText=el('pre',{class:'source-attribution'});libraryForm.append(el('label',{},t('statBlock'),stat),sourceText);
      let draftId=null,draftSource=null,draftPortrait=null;
      const fill=m=>{draftId=m.id;draftSource=m.source;draftPortrait=m.portraitId;name.value=m.name;hp.value=m.hp;ac.value=m.ac;speed.value=m.speed.value;monsterUnit.value=m.speed.unit;showMonsterDistance();size.value=m.size;stat.value=m.statBlock;sourceText.textContent=m.source?`${m.source.author}\n${m.source.edition}\n${m.source.license}\n${m.source.url}`:'';};
      libraryForm.append(button('newMonster',()=>fill({id:null,name:'',hp:1,ac:10,speed:{value:30,unit:'ft'},size:1,statBlock:'',source:null,portraitId:null})),button('saveMonster',()=>send({type:'saveMonster',monster:{id:draftId??id(),name:name.value.trim(),hp:read(hp),ac:read(ac),speed:{value:read(speed),unit:monsterUnit.value},size:read(size),statBlock:stat.value,source:draftSource,portraitId:draftPortrait}})));
      const monsterList=el('div'),encounterList=el('div'),members=el('div'),encounterForm=form(),encounterName=field(encounterForm,'encounterName','');let encounterId=null,spawns=[];
      const px=field(encounterForm,'positionX',1,'number'),py=field(encounterForm,'positionY',1,'number'),concealed=field(encounterForm,'hidden',false,'checkbox');
      const renderSpawns=()=>members.replaceChildren(...spawns.map((m,i)=>el('div',{},board?.monsters?.find(v=>v.id===m.monsterId)?.name??t('remove'),button('remove',()=>{spawns.splice(i,1);renderSpawns();}))));
      encounterForm.append(button('newEncounter',()=>{encounterId=null;encounterName.value='';spawns=[];renderSpawns();}),button('saveEncounter',()=>send({type:'saveEncounter',encounter:{id:encounterId??id(),name:encounterName.value.trim(),members:spawns}})));
      section('monsterLibrary',libraryForm,monsterList);section('encounterLibrary',encounterForm,members,encounterList);
      const assetForm=form(),assetName=field(assetForm,'assetName',''),file=field(assetForm,'importComputer','','file');file.accept='image/png,image/jpeg,image/webp';
      const assetSize=field(assetForm,'tokenSize',1,'number'),assetHidden=field(assetForm,'hidden',false,'checkbox');
      const gallery=el('div',{class:'asset-gallery'}),searchForm=form(),provider=field(searchForm,'catalog','assets','text',[['assets',t('assetLibrary')],['monsters',t('monsterLibrary')]]),query=field(searchForm,'search',''),results=el('div',{'aria-live':'polite',class:'asset-results'});
      const localImport=async()=>{const f=file.files?.[0];if(!f||!online||busy||f.size>32*1024*1024)return;busy=true;syncDisabled();let a;try{a=await api('POST',endpoint+'/maps',f);}catch(e){showError(e);}finally{busy=false;syncDisabled();}if(a&&current())return send({type:'saveAsset',asset:{id:a.id,name:assetName.value.trim()||f.name.slice(0,100),source:null}});};
      assetForm.append(button('importComputer',localImport));
      const lookup=async(entry)=>{if(!online||busy)return;busy=true;syncDisabled();status.textContent=t('working');let response;try{response=await api('POST',endpoint+'/catalog',{kind:provider.value,query:query.value.trim(),entry:entry??null});if(!current())return;if(response.monster){fill(response.monster);status.textContent=t('reviewImport');}else if(!response.asset){results.replaceChildren(...response.entries.map(item=>el('div',{},el('span',{text:item.name}),item.source?el('small',{text:`${item.source.author} · ${item.source.license}`}):null,button('import',()=>{if(provider.value==='assets')assetName.value=item.name.slice(0,100);return lookup(item.id);}))));if(!response.entries.length)results.append(el('p',{text:t('catalogEmpty')}));status.textContent=t('done');}}catch(e){showError(e);}finally{busy=false;syncDisabled();}if(response?.asset&&current())return send({type:'saveAsset',asset:{id:response.asset.id,name:assetName.value.trim()||t('assetLibrary'),source:response.source}});};
      searchForm.append(el('p',{class:'muted',text:t('catalogPrivacy')}),button('search',()=>lookup()));section('assetLibrary',assetForm,gallery);section('publicCatalog',searchForm,results);
      function updateLibrary(){
        const f=config();enabled.checked=f.enabled;vision.checked=f.vision;rangeDisplay();
        walls.replaceChildren(...f.walls.map((w,i)=>el('div',{},el('span',{text:`${t(w.door?'door':'wall')} ${number(i+1)}`}),w.door?button(w.open?'closeDoor':'openDoor',()=>{const next=config();next.walls[i].open=!next.walls[i].open;return saveFog(next);}):null,button('remove',()=>{const next=config();next.walls.splice(i,1);return saveFog(next);}))));
        lights.replaceChildren(...f.lights.map((l,i)=>el('div',{},t('light')+' '+distance(l.range.value,l.range.unit),button('remove',()=>{const next=config();next.lights.splice(i,1);return saveFog(next);}))));
        eyes.replaceChildren(...f.eyes.map((e,i)=>el('div',{},(board?.tokens.find(v=>v.id===e.tokenId)?.name??'')+' '+distance(e.range.value,e.range.unit),button('remove',()=>{const next=config();next.eyes.splice(i,1);return saveFog(next);}))));
        monsterList.replaceChildren(...(board?.monsters??[]).map(m=>el('div',{},el('strong',{text:m.name}),el('span',{text:distance(m.speed.value,m.speed.unit)}),button('editToken',()=>fill(m)),button('addToEncounter',()=>{spawns.push({monsterId:m.id,position:{x:read(px),y:read(py)},hidden:concealed.checked});renderSpawns();}),button('remove',async()=>{if(await confirm(t('remove'),[m.name],t('remove')))return send({type:'removeLibrary',id:m.id,kind:'monster'});}))));
        encounterList.replaceChildren(...(board?.encounters??[]).map(e=>el('div',{},el('strong',{text:e.name}),button('editToken',()=>{encounterId=e.id;encounterName.value=e.name;spawns=clone(e.members);renderSpawns();}),button('deployEncounter',async()=>{if(scene()&&await confirm(t('deployEncounter'),[e.name],t('deployEncounter')))return send({type:'deployEncounter',sceneId:scene().id,encounterId:e.id});}),button('remove',async()=>{if(await confirm(t('remove'),[e.name],t('remove')))return send({type:'removeLibrary',id:e.id,kind:'encounter'});}))));
        gallery.replaceChildren(...(board?.assets??[]).map(a=>{const image=el('img',{alt:a.name,width:80,height:80,loading:'lazy'});thumbnailFor(a.id).then(url=>{if(current()&&url)image.src=url;}).catch(()=>{});return el('div',{},image,el('strong',{text:a.name}),a.source?el('small',{text:`${a.source.author} · ${a.source.license} · ${a.source.url}`}):null,button('placeAsset',()=>scene()&&send({type:'saveToken',token:{id:id(),sceneId:scene().id,ownerId:account,name:a.name,position:{x:read(px),y:read(py)},size:read(assetSize),speed:{value:0,unit:'ft'},hidden:assetHidden.checked,portraitId:a.id,characterId:null,spent:0,diagonals:0,artwork:true}})),button('usePortrait',()=>{draftPortrait=a.id;status.textContent=t('reviewImport');}));}));renderSpawns();
      }
      return {paint,brush,update:updateLibrary};
    }
    if(role==='gm'){sceneEditor();tokenEditor();advanced=advancedEditor();}
    const tracker=window.ChronexusCombat?.create({el,t,role,account,send,getBoard:()=>board,getSelected:()=>selected,getScene:scene,field,button,confirm});if(tracker)panel('combat').append(tracker.root);
    function update(value){if(!current()||(board&&value.revision<board.revision))return;if(!board||value.activeScene!==board.activeScene||(role!=='gm'&&JSON.stringify(value.fog)!==JSON.stringify(board.fog))){imageGeneration++;images.clear();for(const url of urls)URL.revokeObjectURL(url);urls.clear();}board=value;if(chosenScene&&!value.scenes.some(s=>s.id===chosenScene))chosenScene=null;if(selected&&!tokens().some(v=>v.id===selected))selected=null;if(measurement&&measurement.sceneId!==scene()?.id)measurement=null;draw();tracker?.update(value);advanced?.update();syncDisabled();}
    function connected(value){online=value;notice.textContent=t(value?'liveConnected':'liveReconnecting');syncDisabled();}
    function dispose(){disposed=true;pings.length=0;for(const url of urls)URL.revokeObjectURL(url);urls.clear();images.clear();for(const url of thumbUrls)URL.revokeObjectURL(url);thumbUrls.clear();thumbnails.clear();}
    applyView();
    return {root,update,connected,dispose,send,refresh,get snapshot(){return board;},get selected(){return selected;},distance,editor,status,button,field,panel,openPanel,showPing,fit};
  }
  window.ChronexusBoard={create,convert,pixel,snap,path,cost,templateContains,id};
})();

return {board:window.ChronexusBoard,i18n:window.ChronexusI18n};
}
