// Painel do site: adiciona, edita e apaga livros, categorias e botões.
// Salva direto no repositório do GitHub usando a chave de acesso guardada
// neste navegador (localStorage). Nada é enviado para outro lugar.
(function () {
  "use strict";

  var REPO = "americoluismartinsdasilva/americoluismartinsdasilva.github.io";
  var RAMO = "main";
  var ARQ_OBRAS = "js/obras.js";
  // Endereço da API. Só pode ser trocado em testes no próprio computador.
  var API = "https://api.github.com";
  var local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var apiTeste = new URLSearchParams(location.search).get("api");
  if (local && apiTeste) API = apiTeste.replace(/\/$/, "");

  var CHAVE_LS = "painel-chave";
  var dados = null;      // { obras, categorias, idiomas, botoes }
  var shaObras = null;   // versão atual do arquivo no GitHub
  var pendente = null;   // alteração aguardando confirmação
  var editando = null;   // livro em edição (ou null para livro novo)
  var capaNova = null;   // { dataUrl, base64 } da capa escolhida
  var rascunhoCats = null;

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function normal(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function slug(s) { return normal(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  function copia(x) { return JSON.parse(JSON.stringify(x)); }

  // ——— Telas e mensagens ———
  function mostrar(id) {
    $$(".tela").forEach(function (t) { t.hidden = t.id !== "tela-" + id; });
    aviso("");
    window.scrollTo(0, 0);
  }
  function aviso(txt, tipo) {
    var a = $("#aviso");
    a.hidden = !txt; a.className = "aviso " + (tipo || ""); a.innerHTML = txt || "";
    if (txt) a.scrollIntoView({ block: "center" });
  }
  function carregando(txt) {
    $("#carregando").hidden = !txt;
    $("#carregando-texto").textContent = txt || "";
  }

  // ——— GitHub ———
  function chave() { return localStorage.getItem(CHAVE_LS) || ""; }
  function api(caminho, opcoes) {
    opcoes = opcoes || {};
    var cab = { "Accept": "application/vnd.github+json", "Authorization": "Bearer " + chave() };
    if (opcoes.body) cab["Content-Type"] = "application/json";
    return fetch(API + caminho, { method: opcoes.method || "GET", headers: cab, body: opcoes.body ? JSON.stringify(opcoes.body) : undefined, cache: "no-store" })
      .then(function (r) {
        return r.text().then(function (t) {
          var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
          if (!r.ok) { var err = new Error((j && j.message) || ("Erro " + r.status)); err.status = r.status; throw err; }
          return j;
        });
      });
  }
  function b64ParaTexto(b64) {
    var bin = atob(b64.replace(/\s/g, "")), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  }
  function textoParaB64(txt) {
    var bytes = new TextEncoder().encode(txt), bin = "";
    for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function lerArquivo(caminho) {
    return api("/repos/" + REPO + "/contents/" + caminho + "?ref=" + RAMO);
  }
  function gravarArquivo(caminho, base64, mensagem, sha) {
    var corpo = { message: mensagem, content: base64, branch: RAMO };
    if (sha) corpo.sha = sha;
    return api("/repos/" + REPO + "/contents/" + caminho, { method: "PUT", body: corpo });
  }

  function interpretarObras(txt) {
    var w = {};
    new Function("window", txt)(w);
    if (!Array.isArray(w.OBRAS)) throw new Error("O arquivo de livros não foi reconhecido.");
    return {
      obras: w.OBRAS,
      categorias: w.CATEGORIAS || {},
      idiomas: w.IDIOMAS || { pt: "Português" },
      botoes: w.BOTOES || []
    };
  }
  function gerarObras(d) {
    return "// Catálogo de obras de Américo Luís Martins da Silva.\n" +
      "// Este arquivo é atualizado pelo Painel do site (painel.html).\n" +
      "// cat: chave de uma das CATEGORIAS abaixo · lang: chave de um dos IDIOMAS\n" +
      "window.OBRAS = " + JSON.stringify(d.obras, null, 1) + ";\n\n" +
      "window.CATEGORIAS = " + JSON.stringify(d.categorias, null, 1) + ";\n" +
      "window.IDIOMAS = " + JSON.stringify(d.idiomas, null, 1) + ";\n" +
      "window.BOTOES = " + JSON.stringify(d.botoes, null, 1) + ";\n";
  }

  function carregarDados() {
    carregando("Abrindo a lista de livros…");
    return lerArquivo(ARQ_OBRAS).then(function (r) {
      shaObras = r.sha;
      dados = interpretarObras(b64ParaTexto(r.content));
      carregando("");
    });
  }

  function erroAmigavel(e) {
    carregando("");
    if (e.status === 401) {
      localStorage.removeItem(CHAVE_LS);
      mostrar("entrada");
      aviso("A chave de acesso não funcionou. Confira se colou a chave inteira e tente de novo.", "erro");
    } else if (e.status === 409 || e.status === 422) {
      aviso("Outra alteração foi feita ao mesmo tempo. Clique em <strong>Voltar ao início</strong> e faça a alteração de novo.", "erro");
    } else if (e.status === 403 || e.status === 404) {
      aviso("Esta chave não tem permissão para mudar o site. Peça ajuda ao André.", "erro");
    } else {
      aviso("Não foi possível falar com o GitHub. Verifique a internet e tente de novo.<br><small>(" + esc(e.message) + ")</small>", "erro");
    }
  }

  // ——— Entrada ———
  function entrar() {
    var c = $("#chave").value.trim();
    if (!c) { aviso("Cole a chave de acesso no campo acima.", "erro"); return; }
    localStorage.setItem(CHAVE_LS, c);
    carregarDados().then(function () {
      $("#btn-sair").hidden = false;
      $("#chave").value = "";
      mostrar("menu");
    }).catch(erroAmigavel);
  }
  $("#btn-entrar").addEventListener("click", entrar);
  $("#chave").addEventListener("keydown", function (e) { if (e.key === "Enter") entrar(); });
  $("#btn-sair").addEventListener("click", function () {
    if (!confirm("Sair do painel neste computador? Você vai precisar colar a chave de novo para entrar.")) return;
    localStorage.removeItem(CHAVE_LS);
    location.reload();
  });

  // ——— Navegação ———
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-ir]");
    if (!b) return;
    var ir = b.getAttribute("data-ir");
    if (ir === "menu") { carregarDados().then(function () { mostrar("menu"); }).catch(erroAmigavel); }
    else if (ir === "novo") abrirForm(null);
    else if (ir === "lista") { mostrar("lista"); desenharLista(); }
    else if (ir === "categorias") abrirCategorias();
  });

  // ——— Lista de livros ———
  function nomeCat(k) { return dados.categorias[k] || k; }
  function capaUrl(o) { return /^(data:|https?:)/.test(o.img || "") ? o.img : "img/livros/" + o.img; }
  function desenharLista() {
    var t = normal($("#lista-busca").value);
    var lista = dados.obras.filter(function (o) { return !t || normal(o.titulo + " " + (o.serie || "")).indexOf(t) >= 0; });
    $("#lista-contador").textContent = lista.length + (lista.length === 1 ? " livro" : " livros");
    $("#lista-livros").innerHTML = lista.map(function (o) {
      return '<div class="item-livro">' +
        '<img src="' + esc(capaUrl(o)) + '" alt="" loading="lazy">' +
        '<div class="item-texto"><strong>' + esc(o.titulo) + "</strong><span>" +
        esc([nomeCat(o.cat), o.versao, dados.idiomas[o.lang], o.ano].filter(Boolean).join(" · ")) + "</span></div>" +
        '<button class="botao" data-editar="' + esc(o.id) + '">Editar</button>' +
        '<button class="botao vazado perigo" data-apagar="' + esc(o.id) + '">Apagar</button></div>';
    }).join("") || '<p class="ajuda">Nenhum livro encontrado.</p>';
  }
  $("#lista-busca").addEventListener("input", desenharLista);
  $("#lista-livros").addEventListener("click", function (e) {
    var id = e.target.getAttribute("data-editar");
    if (id) abrirForm(acharLivro(id));
    id = e.target.getAttribute("data-apagar");
    if (id) pedirApagar(acharLivro(id));
  });
  function acharLivro(id) { return dados.obras.filter(function (o) { return o.id === id; })[0]; }

  // ——— Formulário ———
  function preencherSelects() {
    $("#sel-cat").innerHTML = Object.keys(dados.categorias).map(function (k) { return '<option value="' + esc(k) + '">' + esc(dados.categorias[k]) + "</option>"; }).join("");
    $("#sel-lang").innerHTML = Object.keys(dados.idiomas).map(function (k) { return '<option value="' + esc(k) + '">' + esc(dados.idiomas[k]) + "</option>"; }).join("");
  }
  function asinDe(txt) {
    txt = String(txt || "").trim();
    var m = txt.match(/\/(?:dp|gp\/product|d)\/([A-Z0-9]{10})(?:[/?#]|$)/i) || txt.match(/^([A-Z0-9]{10})$/i);
    return m ? m[1].toUpperCase() : "";
  }
  function mostrarCodigos() {
    var f = $("#form-livro");
    [["linkEbook", "#cod-ebook"], ["linkImpresso", "#cod-impresso"]].forEach(function (p) {
      var v = f.elements[p[0]].value.trim(), a = asinDe(v), el = $(p[1]);
      el.className = "ajuda codigo " + (v && !a ? "erro" : "ok");
      el.textContent = !v ? "" : a ? "✔ Código do livro encontrado: " + a : "Não reconheci este endereço. Copie o endereço inteiro da página do livro na Amazon.";
    });
  }
  function abrirForm(o) {
    editando = o; capaNova = null;
    preencherSelects();
    var f = $("#form-livro"); f.reset();
    $("#form-titulo").textContent = o ? "Editar livro" : "Adicionar um livro novo";
    $("#btn-apagar").hidden = !o;
    var img = $("#capa-previa");
    if (o) {
      ["titulo", "cat", "lang", "serie", "original", "versao", "desc", "edicao", "ano", "paginas", "isbn"].forEach(function (k) { if (f.elements[k]) f.elements[k].value = o[k] == null ? "" : o[k]; });
      f.elements.linkEbook.value = o.asin ? "https://www.amazon.com.br/dp/" + o.asin : "";
      f.elements.linkImpresso.value = o.asinImpresso ? "https://www.amazon.com.br/dp/" + o.asinImpresso : "";
      f.elements.capaDura.checked = !!o.capaDura;
      f.elements.destaque.checked = !!o.destaque;
      img.src = capaUrl(o); img.hidden = false;
    } else {
      f.elements.lang.value = "pt";
      img.hidden = true; img.removeAttribute("src");
    }
    mostrarCodigos();
    mostrar("form");
  }
  $("#form-livro").addEventListener("input", function (e) { if (/^link/.test(e.target.name)) mostrarCodigos(); });

  // Reduz a capa para no máximo 500 × 750 e converte para JPG.
  $("#capa-arquivo").addEventListener("change", function () {
    var arq = this.files && this.files[0];
    if (!arq) return;
    var leitor = new FileReader();
    leitor.onload = function () {
      var im = new Image();
      im.onload = function () {
        var esc = Math.min(1, 500 / im.width, 750 / im.height);
        var c = document.createElement("canvas");
        c.width = Math.round(im.width * esc); c.height = Math.round(im.height * esc);
        var ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(im, 0, 0, c.width, c.height);
        var url = c.toDataURL("image/jpeg", 0.85);
        capaNova = { dataUrl: url, base64: url.split(",")[1] };
        var img = $("#capa-previa"); img.src = url; img.hidden = false;
      };
      im.onerror = function () { aviso("Este arquivo não é uma imagem que o navegador consiga abrir. Escolha um arquivo JPG ou PNG.", "erro"); };
      im.src = leitor.result;
    };
    leitor.readAsDataURL(arq);
  });

  $("#form-livro").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = this, v = function (k) { return f.elements[k].value.trim(); };
    if (!v("titulo")) { aviso("Escreva o título do livro.", "erro"); f.elements.titulo.focus(); return; }
    if (!editando && !capaNova) { aviso("Escolha a imagem da capa (passo 1).", "erro"); return; }
    if (v("linkEbook") && !asinDe(v("linkEbook"))) { aviso("O endereço do e-book não foi reconhecido (passo 4).", "erro"); return; }
    if (v("linkImpresso") && !asinDe(v("linkImpresso"))) { aviso("O endereço do livro impresso não foi reconhecido (passo 4).", "erro"); return; }

    var novo = dados.obras.slice();
    var livro = editando ? copia(editando) : {};
    if (!editando) {
      var maior = novo.reduce(function (m, o) { return Math.max(m, o.n || 0); }, 0);
      livro.n = maior + 1;
      livro.id = "l" + String(livro.n).padStart(3, "0");
    }
    ["titulo", "cat", "lang", "serie", "original", "versao", "desc", "edicao", "isbn"].forEach(function (k) {
      if (v(k)) livro[k] = v(k); else delete livro[k];
    });
    if (/^\d+$/.test(v("ano"))) livro.ano = +v("ano"); else delete livro.ano;
    if (v("paginas")) livro.paginas = v("paginas"); else delete livro.paginas;
    var a1 = asinDe(v("linkEbook")), a2 = asinDe(v("linkImpresso"));
    if (a1) livro.asin = a1; else delete livro.asin;
    if (a2) livro.asinImpresso = a2; else delete livro.asinImpresso;
    if (f.elements.capaDura.checked) livro.capaDura = true; else delete livro.capaDura;
    if (f.elements.destaque.checked) livro.destaque = true; else delete livro.destaque;

    var arquivoCapa = null;
    if (capaNova) {
      arquivoCapa = String(livro.n).padStart(3, "0") + "-" + Date.now().toString(36) + ".jpg";
      livro.img = arquivoCapa;
    }
    var livroPrevia = copia(livro);
    if (capaNova) livroPrevia.img = capaNova.dataUrl;

    var obrasPublicar, obrasPrevia;
    if (editando) {
      obrasPublicar = novo.map(function (o) { return o.id === livro.id ? livro : o; });
      obrasPrevia = novo.map(function (o) { return o.id === livro.id ? livroPrevia : o; });
    } else {
      obrasPublicar = [livro].concat(novo);       // livros novos aparecem primeiro
      obrasPrevia = [livroPrevia].concat(novo);
    }
    pendente = {
      tipo: editando ? "editar" : "novo",
      dados: { obras: obrasPublicar, categorias: dados.categorias, idiomas: dados.idiomas, botoes: dados.botoes },
      previa: { obras: obrasPrevia, categorias: dados.categorias, idiomas: dados.idiomas, botoes: dados.botoes },
      capa: arquivoCapa ? { caminho: "img/livros/" + arquivoCapa, base64: capaNova.base64 } : null,
      livroId: livro.id,
      mensagem: (editando ? "Painel: edita o livro " : "Painel: adiciona o livro ") + livro.titulo,
      pronto: editando ? "As mudanças no livro <strong>" + esc(livro.titulo) + "</strong> foram enviadas." : "O livro <strong>" + esc(livro.titulo) + "</strong> foi adicionado ao site.",
      voltar: "form"
    };
    abrirPrevia("ficha");
  });

  function pedirApagar(o) {
    if (!o) return;
    var resto = dados.obras.filter(function (x) { return x.id !== o.id; });
    pendente = {
      tipo: "apagar",
      dados: { obras: resto, categorias: dados.categorias, idiomas: dados.idiomas, botoes: dados.botoes },
      previa: { obras: resto, categorias: dados.categorias, idiomas: dados.idiomas, botoes: dados.botoes },
      capa: null, livroId: null,
      mensagem: "Painel: apaga o livro " + o.titulo,
      pronto: "O livro <strong>" + esc(o.titulo) + "</strong> foi tirado do site.",
      voltar: "lista"
    };
    abrirPrevia("pagina", "Apagar “" + o.titulo + "”?",
      "Se você confirmar, este livro <strong>sairá do site</strong>. Abaixo está a página de obras já sem ele.");
  }
  $("#btn-apagar").addEventListener("click", function () { pedirApagar(editando); });

  // ——— Categorias e botões ———
  function abrirCategorias() {
    rascunhoCats = { categorias: copia(dados.categorias), botoes: copia(dados.botoes) };
    desenharCategorias();
    mostrar("categorias");
  }
  function usoCat(k) { return dados.obras.filter(function (o) { return o.cat === k; }).length; }
  function desenharCategorias() {
    var c = rascunhoCats.categorias;
    $("#lista-cats").innerHTML = Object.keys(c).map(function (k) {
      var n = usoCat(k);
      return '<div class="linha-cat"><input data-cat="' + esc(k) + '" value="' + esc(c[k]) + '" aria-label="Nome da categoria">' +
        '<span class="ajuda">' + n + (n === 1 ? " livro" : " livros") + "</span>" +
        (n ? "" : '<button class="botao vazado perigo pequeno" data-tirar-cat="' + esc(k) + '">Apagar</button>') + "</div>";
    }).join("");
    $("#lista-botoes").innerHTML = rascunhoCats.botoes.map(function (b, i) {
      return '<div class="cartao-botao" data-i="' + i + '">' +
        '<div class="linha-cat"><span class="filtro-amostra">' + esc(b.nome || "(sem nome)") + "</span>" +
        '<input data-nome-botao="' + i + '" value="' + esc(b.nome) + '" aria-label="Nome do botão" placeholder="Nome do botão">' +
        '<button class="botao vazado pequeno" data-mover="' + i + ':-1" title="Mover para a esquerda"' + (i === 0 ? " disabled" : "") + ">◀</button>" +
        '<button class="botao vazado pequeno" data-mover="' + i + ':1" title="Mover para a direita"' + (i === rascunhoCats.botoes.length - 1 ? " disabled" : "") + ">▶</button>" +
        '<button class="botao vazado perigo pequeno" data-tirar-botao="' + i + '">Apagar botão</button></div>' +
        '<div class="cats-do-botao"><span>Este botão mostra:</span>' +
        Object.keys(c).map(function (k) {
          return '<label class="marcar"><input type="checkbox" data-botao-cat="' + i + ":" + esc(k) + '"' + (b.categorias.indexOf(k) >= 0 ? " checked" : "") + "> " + esc(c[k]) + "</label>";
        }).join("") + "</div></div>";
    }).join("");
  }
  $("#tela-categorias").addEventListener("input", function (e) {
    var t = e.target;
    if (t.hasAttribute("data-cat")) rascunhoCats.categorias[t.getAttribute("data-cat")] = t.value;
    if (t.hasAttribute("data-nome-botao")) {
      rascunhoCats.botoes[+t.getAttribute("data-nome-botao")].nome = t.value;
      t.parentNode.querySelector(".filtro-amostra").textContent = t.value || "(sem nome)";
    }
  });
  $("#tela-categorias").addEventListener("change", function (e) {
    var t = e.target, v = t.getAttribute("data-botao-cat");
    if (!v) return;
    var p = v.split(":"), b = rascunhoCats.botoes[+p[0]], k = p.slice(1).join(":");
    b.categorias = b.categorias.filter(function (x) { return x !== k; });
    if (t.checked) b.categorias.push(k);
  });
  $("#tela-categorias").addEventListener("click", function (e) {
    var t = e.target, v;
    if ((v = t.getAttribute("data-tirar-cat"))) {
      delete rascunhoCats.categorias[v];
      rascunhoCats.botoes.forEach(function (b) { b.categorias = b.categorias.filter(function (x) { return x !== v; }); });
      desenharCategorias();
    } else if ((v = t.getAttribute("data-tirar-botao"))) {
      if (confirm("Apagar o botão “" + rascunhoCats.botoes[+v].nome + "”? (Os livros não são apagados.)")) { rascunhoCats.botoes.splice(+v, 1); desenharCategorias(); }
    } else if ((v = t.getAttribute("data-mover"))) {
      var p = v.split(":"), i = +p[0], j = i + +p[1], bs = rascunhoCats.botoes, tmp = bs[i];
      bs[i] = bs[j]; bs[j] = tmp; desenharCategorias();
    }
  });
  $("#btn-add-cat").addEventListener("click", function () {
    var nome = $("#nova-cat").value.trim();
    if (!nome) { aviso("Escreva o nome da nova categoria.", "erro"); return; }
    var k = slug(nome) || "categoria", base = k, i = 2;
    while (rascunhoCats.categorias[k]) k = base + "-" + i++;
    rascunhoCats.categorias[k] = nome;
    $("#nova-cat").value = "";
    desenharCategorias();
    aviso("Categoria “" + esc(nome) + "” criada. Para ela aparecer num botão, marque-a em um dos botões abaixo.", "ok");
  });
  $("#btn-add-botao").addEventListener("click", function () {
    rascunhoCats.botoes.push({ nome: "Novo botão", categorias: [] });
    desenharCategorias();
    var ult = $$("[data-nome-botao]").pop(); if (ult) { ult.focus(); ult.select(); }
  });
  $("#btn-previa-cats").addEventListener("click", function () {
    var semNome = Object.keys(rascunhoCats.categorias).some(function (k) { return !rascunhoCats.categorias[k].trim(); }) ||
      rascunhoCats.botoes.some(function (b) { return !b.nome.trim(); });
    if (semNome) { aviso("Há uma categoria ou um botão sem nome. Escreva um nome ou apague.", "erro"); return; }
    var d = { obras: dados.obras, categorias: rascunhoCats.categorias, idiomas: dados.idiomas, botoes: rascunhoCats.botoes };
    pendente = {
      tipo: "categorias", dados: d, previa: d, capa: null, livroId: null,
      mensagem: "Painel: atualiza categorias e botões",
      pronto: "As categorias e os botões foram atualizados.",
      voltar: "categorias"
    };
    abrirPrevia("pagina");
  });

  // ——— Prévia ———
  function abrirPrevia(aba, titulo, texto) {
    localStorage.setItem("painel-previa", JSON.stringify(pendente.previa));
    $("#previa-titulo").textContent = titulo || "Veja como vai ficar";
    $("#previa-texto").innerHTML = texto || "Isto ainda <strong>não</strong> está no site. Confira e, se estiver tudo certo, clique em <strong>Confirmar e publicar</strong>.";
    $("#previa-abas").hidden = !pendente.livroId;
    mostrar("previa");
    trocarAba(pendente.livroId ? aba : "pagina");
  }
  function trocarAba(aba) {
    $$("#previa-abas button").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-aba") === aba); });
    var hash = pendente.livroId ? "#" + (aba === "ficha" ? "ficha=" : "livro=") + pendente.livroId : "";
    $("#previa-frame").src = "obras.html?previa=1&t=" + Date.now() + hash;
  }
  $("#previa-abas").addEventListener("click", function (e) { var a = e.target.getAttribute("data-aba"); if (a) trocarAba(a); });
  $("#btn-corrigir").addEventListener("click", function () { mostrar(pendente.voltar); if (pendente.voltar === "lista") desenharLista(); });

  $("#btn-confirmar").addEventListener("click", function () {
    var p = pendente;
    $("#btn-confirmar").disabled = true;
    var passo = Promise.resolve();
    if (p.capa) {
      passo = passo.then(function () {
        carregando("Enviando a capa…");
        return gravarArquivo(p.capa.caminho, p.capa.base64, p.mensagem + " (capa)");
      });
    }
    passo.then(function () {
      carregando("Salvando a lista de livros…");
      return gravarArquivo(ARQ_OBRAS, textoParaB64(gerarObras(p.dados)), p.mensagem, shaObras);
    }).then(function (r) {
      shaObras = r && r.content && r.content.sha;
      dados = p.dados;
      pendente = null;
      localStorage.removeItem("painel-previa");
      carregando("");
      $("#pronto-texto").innerHTML = p.pronto;
      mostrar("pronto");
    }).catch(erroAmigavel).then(function () { $("#btn-confirmar").disabled = false; });
  });

  // ——— Início ———
  if (chave()) {
    $("#btn-sair").hidden = false;
    carregarDados().then(function () { mostrar("menu"); }).catch(erroAmigavel);
  } else {
    mostrar("entrada");
  }
})();
