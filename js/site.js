// Cabeçalho, rodapé, estante de livros e ficha de cada obra.
(function () {
  // Modo de prévia do painel: usa os dados ainda não publicados.
  var PREVIA = /[?&]previa=1/.test(location.search);
  if (PREVIA) {
    try {
      var p = JSON.parse(localStorage.getItem("painel-previa") || "null");
      if (p) { window.OBRAS = p.obras; window.CATEGORIAS = p.categorias; window.IDIOMAS = p.idiomas; window.BOTOES = p.botoes; }
    } catch (e) {}
  }
  var paginas = [
    ["index.html", "Início"], ["obras.html", "Conheça as obras"], ["biografia.html", "Biografia"],
    ["bibliografia.html", "Bibliografia"], ["contato.html", "Contato"]
  ];
  var atual = location.pathname.split("/").pop() || "index.html";

  var topo = document.getElementById("topo");
  if (topo) {
    topo.className = "topo";
    topo.innerHTML =
      '<div class="container">' +
      '<a class="marca" href="index.html">Américo Luís Martins da Silva<small>Jurista · Escritor</small></a>' +
      '<button class="menu-botao" aria-expanded="false" aria-controls="menu">Menu</button>' +
      '<ul class="menu" id="menu">' +
      paginas.map(function (p) {
        return '<li><a href="' + p[0] + '"' + (p[0] === atual ? ' aria-current="page"' : "") + ">" + p[1] + "</a></li>";
      }).join("") + "</ul></div>";
    var botao = topo.querySelector(".menu-botao"), menu = topo.querySelector(".menu");
    botao.addEventListener("click", function () {
      var aberto = menu.classList.toggle("aberto");
      botao.setAttribute("aria-expanded", aberto);
    });
  }

  var rodape = document.getElementById("rodape");
  if (rodape) {
    rodape.className = "rodape";
    rodape.innerHTML =
      '<div class="container"><a class="marca" href="index.html">Américo Luís Martins da Silva</a>' +
      "<p>Uma vida dedicada ao ensino jurídico e ao entretenimento literário.</p>" +
      '<p>Livros à venda na <a href="https://www.amazon.com.br/Americo-Luis-Martins-Da-Silva/e/B001JY85KI" target="_blank" rel="noopener">Amazon.com.br</a>, ' +
      'na <a href="https://www.amazon.com/author/americo.silva" target="_blank" rel="noopener">Amazon.com</a> e pela Editora Cronus.</p>' +
      "<p>© " + new Date().getFullYear() + " Américo Luís Martins da Silva</p></div>";
  }

  // ——— Livros ———
  var OBRAS = window.OBRAS || [], CAT = window.CATEGORIAS || {}, IDI = window.IDIOMAS || {};
  function capa(o) { return /^(data:|https?:)/.test(o.img || "") ? o.img : "img/livros/" + o.img; }
  function linkAmazon(o) { return o.asin ? "https://www.amazon.com.br/dp/" + o.asin : "https://www.amazon.com.br/s?k=" + encodeURIComponent(o.titulo + " Américo Luís Martins da Silva"); }
  function linkImpresso(o) { return "https://www.amazon.com.br/dp/" + o.asinImpresso; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function meta(o) {
    return [CAT[o.cat], o.versao, o.lang !== "pt" ? IDI[o.lang] : "", o.ano].filter(Boolean).join(" · ");
  }

  function cartao(o) {
    return '<button class="livro" data-id="' + o.id + '">' +
      '<div class="capa"><img src="' + capa(o) + '" alt="Capa de ' + esc(o.titulo) + '" loading="lazy"></div>' +
      "<h3>" + esc(o.titulo) + "</h3>" +
      (o.coautoria ? '<div class="meta">Com ' + esc(o.coautoria) + "</div>" : "") +
      '<div class="meta">' + meta(o) + "</div></button>";
  }

  var dialogo;
  function abrirFicha(id) {
    var o = OBRAS.filter(function (x) { return x.id === id; })[0];
    if (!o) return;
    if (!dialogo) {
      dialogo = document.createElement("dialog");
      dialogo.className = "ficha";
      document.body.appendChild(dialogo);
      dialogo.addEventListener("click", function (e) { if (e.target === dialogo) dialogo.close(); });
    }
    var dados = [];
    if (o.edicao) dados.push(o.edicao);
    if (o.paginas) dados.push(o.paginas + " páginas");
    if (o.isbn) dados.push("ISBN " + o.isbn);
    dados.push("E-book Kindle" + (o.asinImpresso ? ", livro impresso" : "") + (o.capaDura ? " e capa dura" : ""));
    dialogo.innerHTML =
      '<button class="ficha-fechar" aria-label="Fechar">×</button>' +
      '<div class="ficha-corpo"><img src="' + capa(o) + '" alt="Capa de ' + esc(o.titulo) + '">' +
      "<div>" +
      '<div class="sobretitulo">' + meta(o) + "</div>" +
      "<h2>" + esc(o.titulo) + "</h2>" +
      (o.coautoria ? '<div class="serie"><strong>Coautoria:</strong> ' + esc(o.coautoria) + "</div>" : "") +
      (o.serie ? '<div class="serie">Série “' + esc(o.serie) + "”</div>" : "") +
      (o.original ? '<div class="serie">Tradução da obra “' + esc(o.original) + "”</div>" : "") +
      (o.desc ? "<p>" + esc(o.desc) + "</p>" : "") +
      '<div class="isbn">' + dados.join(" · ") + "</div>" +
      '<a class="botao" href="' + linkAmazon(o) + '" target="_blank" rel="noopener">E-book na Amazon</a>' +
      (o.asinImpresso ? ' <a class="botao vazado" href="' + linkImpresso(o) + '" target="_blank" rel="noopener">Livro impresso</a>' : "") +
      "</div></div>";
    dialogo.querySelector(".ficha-fechar").addEventListener("click", function () { dialogo.close(); });
    dialogo.showModal();
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest(".livro");
    if (b) abrirFicha(b.getAttribute("data-id"));
  });

  // Destaques na página inicial
  var dest = document.getElementById("destaques");
  if (dest) dest.innerHTML = OBRAS.filter(function (o) { return o.destaque; }).map(cartao).join("");

  // Números
  document.querySelectorAll("[data-conta]").forEach(function (el) {
    var t = el.getAttribute("data-conta");
    el.textContent = t === "todas" ? OBRAS.length :
      t === "literatura" ? OBRAS.filter(function (o) { return o.cat !== "direito"; }).length :
      t === "traducoes" ? OBRAS.filter(function (o) { return o.lang !== "pt"; }).length :
      OBRAS.filter(function (o) { return o.cat === t; }).length;
  });

  // Catálogo completo com filtros
  var estante = document.getElementById("estante");
  if (estante) {
    var filtro = "todas", idioma = "pt", termo = "";
    var BOTOES = window.BOTOES || [
      { nome: "Literatura", categorias: ["romance", "conto", "poesia", "cronica"] },
      { nome: "Direito", categorias: ["direito"] },
      { nome: "Biografias", categorias: ["biografia"] }
    ];
    function slug(s) { return normal(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
    var porSlug = {};
    BOTOES.forEach(function (b) { porSlug[slug(b.nome)] = b; });
    var grupos = [["todas", "Todas"]].concat(BOTOES.map(function (b) { return [slug(b.nome), b.nome]; }));
    var caixa = document.getElementById("filtros");
    caixa.innerHTML = grupos.map(function (g) {
      return '<button data-f="' + g[0] + '" aria-pressed="' + (g[0] === filtro) + '">' + g[1] + "</button>";
    }).join("");
    var cxIdioma = document.getElementById("idiomas");
    var langs = [["pt", "Em português"]].concat(
      ["en", "es", "fr", "de", "it"].map(function (l) { return [l, IDI[l]]; }),
      [["todos", "Todos os idiomas"]]);
    cxIdioma.innerHTML = langs.map(function (g) {
      return '<button data-l="' + g[0] + '" aria-pressed="' + (g[0] === idioma) + '">' + g[1] + "</button>";
    }).join("");
    caixa.addEventListener("click", function (e) {
      var f = e.target.getAttribute("data-f"); if (!f) return;
      filtro = f;
      caixa.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", b === e.target); });
      desenhar();
    });
    cxIdioma.addEventListener("click", function (e) {
      var l = e.target.getAttribute("data-l"); if (!l) return;
      idioma = l;
      cxIdioma.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", b === e.target); });
      desenhar();
    });
    var busca = document.getElementById("busca"), contador = document.getElementById("contador");
    busca.addEventListener("input", function () { termo = normal(busca.value); desenhar(); });
    function normal(s) { return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
    function desenhar() {
      var lista = OBRAS.filter(function (o) {
        var okCat = filtro === "todas" || (porSlug[filtro] && porSlug[filtro].categorias.indexOf(o.cat) >= 0);
        var okLang = idioma === "todos" || o.lang === idioma;
        return okCat && okLang && (!termo || normal(o.titulo + " " + (o.coautoria || "") + " " + (o.serie || "") + " " + (o.original || "") + " " + (o.desc || "")).indexOf(termo) >= 0);
      });
      contador.textContent = lista.length + (lista.length === 1 ? " obra" : " obras");
      estante.innerHTML = lista.length ? lista.map(cartao).join("") :
        '<p style="grid-column:1/-1;text-align:center;font-style:italic">Nenhuma obra encontrada.</p>';
    }
    var hash = decodeURIComponent(location.hash.slice(1));
    if (hash === "biografia") hash = "biografias";
    var alvo = /^(livro|ficha)=/.test(hash) ? OBRAS.filter(function (o) { return o.id === hash.split("=")[1]; })[0] : null;
    if (alvo) {
      // Prévia de um livro: mostra o idioma dele e destaca o cartão.
      idioma = alvo.lang;
      cxIdioma.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-l") === idioma); });
      desenhar();
      var cartaoEl = estante.querySelector('[data-id="' + alvo.id + '"]');
      if (cartaoEl) { cartaoEl.classList.add("destacado"); window.scrollTo(0, cartaoEl.getBoundingClientRect().top + window.pageYOffset - window.innerHeight / 3); }
      if (hash.indexOf("ficha=") === 0) abrirFicha(alvo.id);
    } else if (porSlug[hash]) caixa.querySelector('[data-f="' + hash + '"]').click();
    else desenhar();
  }
})();
