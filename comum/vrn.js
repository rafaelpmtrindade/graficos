/* Gráficos do Vila Rica News — motor comum
   Cada página chama VRN.grafico({...}) com os passos (abas). Cada passo tem um painel
   de números e uma visualização: "pontos", "barras" ou "piramide".
   Dentro de iframe o gráfico ocupa a altura toda do iframe (a altura é fixa no editor do site). */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var CELULA_MAX = 40;
  var DURACAO_PASSO = 5200;

  function n(v) { return v.toLocaleString('pt-BR'); }
  function pct(v, casas) {
    if (casas == null) casas = 1;
    return (v * 100).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }) + '%';
  }
  function soma(lista, campo) { return lista.reduce(function (s, x) { return s + (campo ? x[campo] : x); }, 0); }

  // ---------- Pontos: N pontos em grade, um grupo depois do outro, por coluna ----------
  function Pontos(camada, v, reduzido) {
    var N = soma(v.grupos, 'pontos');
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    camada.appendChild(svg);
    var pts = [], grupoDe = [];
    v.grupos.forEach(function (g) {
      for (var k = 0; k < g.pontos; k++) {
        var c = document.createElementNS(NS, 'circle');
        c.setAttribute('r', 8);
        c.setAttribute('class', 'vrn-ponto' + (g.vazado ? ' vazado' : ''));
        c.style.setProperty('--cor', g.cor);
        svg.appendChild(c);
        pts.push(c);
        grupoDe.push(g);
      }
    });
    var col = 10, lin = 10;
    function vazios() { return col * lin - N; }

    return {
      // escolhe a grade que dá o maior ponto dentro de W × H
      desenhar: function (W, H) {
        var melhor = null;
        (v.colunas || [10, 20, 25]).forEach(function (c) {
          var l = Math.ceil(N / c), s = Math.min(W / c, H / l, CELULA_MAX);
          if (!melhor || s > melhor.s + 0.01) melhor = { c: c, l: l, s: s };
        });
        col = melhor.c; lin = melhor.l;
        svg.setAttribute('viewBox', '0 0 ' + col * 24 + ' ' + lin * 24);
        svg.style.width = col * melhor.s + 'px';
        svg.style.height = lin * melhor.s + 'px';
        pts.forEach(function (p, i) {
          var cc = Math.floor(i / lin), ll = i % lin;
          // a última coluna (incompleta) encosta embaixo
          if (cc === col - 1) ll += vazios();
          p.setAttribute('cx', cc * 24 + 12);
          p.setAttribute('cy', ll * 24 + 12);
          p.dataset.col = cc;
          p.dataset.lin = ll;
        });
      },
      entrar: function (animar) {
        pts.forEach(function (p) {
          p.style.transitionDelay = animar && !reduzido ? (+p.dataset.col * 30 + +p.dataset.lin * 8) + 'ms' : '0ms';
          p.classList.add('visivel');
        });
      },
      sair: function () {
        pts.forEach(function (p) { p.style.transitionDelay = '0ms'; p.classList.remove('visivel'); });
      },
      alvo: function (ev) {
        var r = svg.getBoundingClientRect();
        if (!r.width) return null;
        var s = r.width / col;
        var cc = Math.floor((ev.clientX - r.left) / s), ll = Math.floor((ev.clientY - r.top) / s);
        if (cc < 0 || cc >= col || ll < 0 || ll >= lin) return null;
        var linhaTela = ll;
        if (cc === col - 1) { if (ll < vazios()) return null; ll -= vazios(); }
        var i = cc * lin + ll;
        if (i >= N) return null;
        return { chave: grupoDe[i], html: grupoDe[i].dica, x: r.left + (cc + 0.5) * s, y: r.top + linhaTela * s };
      },
      destacar: function (chave) {
        pts.forEach(function (p, i) { p.classList.toggle('vrn-apagado', !!chave && grupoDe[i] !== chave); });
      }
    };
  }

  // ---------- Barras: uma por linha, rótulo em cima, número na ponta ----------
  function Barras(camada, v, reduzido) {
    var box = document.createElement('div');
    box.className = 'vrn-barras';
    camada.appendChild(box);
    var max = v.max || Math.max.apply(null, v.linhas.map(function (l) { return l.valor; }));
    var linhas = v.linhas.map(function (l) {
      var row = document.createElement('div');
      row.className = 'vrn-barra';
      row.innerHTML = '<div class="vrn-barra-rotulo">' + l.rotulo + (l.extra ? '<span>' + l.extra + '</span>' : '') + '</div>' +
        '<div class="vrn-barra-linha"><div class="vrn-barra-fill"></div><div class="vrn-barra-valor">' + n(l.valor) + '</div></div>';
      var fill = row.querySelector('.vrn-barra-fill');
      fill.style.setProperty('--cor', l.cor);
      box.appendChild(row);
      return { row: row, fill: fill, dados: l };
    });
    var util = 0;
    function largura(o) { o.fill.style.width = Math.max(2, o.dados.valor / max * util) + 'px'; }

    return {
      desenhar: function (W, H) {
        // linhas encolhem até 26px quando falta altura (celular estreito); abaixo de 32px, letra menor
        var alt = Math.max(26, Math.min(60, H / linhas.length));
        box.classList.toggle('vrn-compacto', alt < 32);
        box.style.setProperty('--vrn-linha', alt + 'px');
        box.style.setProperty('--vrn-espessura', Math.max(8, Math.min(22, Math.round(alt * 0.36))) + 'px');
        util = Math.max(40, W - 64); // sobra para o número na ponta
        linhas.forEach(function (o) { if (o.row.classList.contains('visivel')) largura(o); });
      },
      entrar: function (animar) {
        linhas.forEach(function (o, i) {
          o.fill.style.transitionDelay = animar && !reduzido ? i * 80 + 'ms' : '0ms';
          o.row.classList.add('visivel');
          largura(o);
        });
      },
      sair: function () {
        linhas.forEach(function (o) { o.fill.style.transitionDelay = '0ms'; o.row.classList.remove('visivel'); o.fill.style.width = '0'; });
      },
      alvo: function (ev) {
        var row = ev.target.closest ? ev.target.closest('.vrn-barra') : null;
        var o = linhas.filter(function (x) { return x.row === row; })[0];
        if (!o) return null;
        var rf = o.fill.getBoundingClientRect(), rr = row.getBoundingClientRect();
        return { chave: o, html: o.dados.dica, x: rf.left + rf.width / 2, y: rr.top };
      },
      destacar: function (chave) {
        linhas.forEach(function (o) { o.row.classList.toggle('vrn-apagado', !!chave && o !== chave); });
      }
    };
  }

  // ---------- Pirâmide: dois lados a partir do centro, rótulo em cima ----------
  function Piramide(camada, v, reduzido) {
    var box = document.createElement('div');
    box.className = 'vrn-piramide';
    camada.appendChild(box);
    var chaves = document.createElement('div');
    chaves.className = 'vrn-pir-chaves';
    chaves.innerHTML = '<span><i class="vrn-bolinha" style="background:' + v.esquerda.cor + '"></i>' + v.esquerda.nome + '</span>' +
      '<span>' + v.direita.nome + '<i class="vrn-bolinha" style="background:' + v.direita.cor + '"></i></span>';
    box.appendChild(chaves);
    var max = Math.max.apply(null, v.linhas.map(function (l) { return Math.max(l.e, l.d); }));
    var linhas = v.linhas.map(function (l) {
      var row = document.createElement('div');
      row.className = 'vrn-pir';
      row.innerHTML = '<div class="vrn-pir-rotulo">' + l.rotulo + '</div><div class="vrn-pir-linha">' +
        '<div class="vrn-pir-lado esq"><div class="vrn-pir-fill"></div><div class="vrn-pir-valor' + (l.e > l.d ? ' maior' : '') + '">' + n(l.e) + '</div></div>' +
        '<div class="vrn-pir-lado dir"><div class="vrn-pir-fill"></div><div class="vrn-pir-valor' + (l.d > l.e ? ' maior' : '') + '">' + n(l.d) + '</div></div></div>';
      var fills = row.querySelectorAll('.vrn-pir-fill');
      fills[0].style.setProperty('--cor', v.esquerda.cor);
      fills[1].style.setProperty('--cor', v.direita.cor);
      box.appendChild(row);
      return { row: row, fe: fills[0], fd: fills[1], dados: l };
    });
    var meia = 0;
    function larguras(o) {
      o.fe.style.width = Math.max(2, o.dados.e / max * meia) + 'px';
      o.fd.style.width = Math.max(2, o.dados.d / max * meia) + 'px';
    }

    return {
      desenhar: function (W, H) {
        var alt = Math.max(26, Math.min(52, (H - chaves.offsetHeight - 4) / linhas.length));
        box.classList.toggle('vrn-compacto', alt < 32);
        box.style.setProperty('--vrn-linha', alt + 'px');
        box.style.setProperty('--vrn-espessura', Math.max(8, Math.min(20, Math.round(alt * 0.4))) + 'px');
        meia = Math.max(30, (W - 2) / 2 - 56); // sobra para o número na ponta
        linhas.forEach(function (o) { if (o.row.classList.contains('visivel')) larguras(o); });
      },
      entrar: function (animar) {
        linhas.forEach(function (o, i) {
          var atraso = animar && !reduzido ? i * 70 + 'ms' : '0ms';
          o.fe.style.transitionDelay = atraso;
          o.fd.style.transitionDelay = atraso;
          o.row.classList.add('visivel');
          larguras(o);
        });
      },
      sair: function () {
        linhas.forEach(function (o) {
          o.fe.style.transitionDelay = o.fd.style.transitionDelay = '0ms';
          o.row.classList.remove('visivel');
          o.fe.style.width = o.fd.style.width = '0';
        });
      },
      alvo: function (ev) {
        var row = ev.target.closest ? ev.target.closest('.vrn-pir') : null;
        var o = linhas.filter(function (x) { return x.row === row; })[0];
        if (!o) return null;
        var rr = row.getBoundingClientRect();
        return { chave: o, html: o.dados.dica, x: rr.left + rr.width / 2, y: rr.top };
      },
      destacar: function (chave) {
        linhas.forEach(function (o) { o.row.classList.toggle('vrn-apagado', !!chave && o !== chave); });
      }
    };
  }

  var TIPOS = { pontos: Pontos, barras: Barras, piramide: Piramide };

  function tabelaHtml(t) {
    var h = '<table><thead><tr>' +
      t.colunas.map(function (c) { return '<th scope="col">' + c + '</th>'; }).join('') + '</tr></thead><tbody>';
    t.grupos.forEach(function (g) {
      if (g.titulo) h += '<tr class="vrn-grupo"><th scope="rowgroup" colspan="' + t.colunas.length + '">' + g.titulo + '</th></tr>';
      g.linhas.forEach(function (l) {
        h += '<tr><th scope="row">' + l[0] + '</th>' + l.slice(1).map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>';
      });
    });
    return h + '</tbody></table>';
  }

  function grafico(cfg) {
    var raiz = document.getElementById('vrn');
    var reduzido = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var emIframe = window.self !== window.top;
    raiz.classList.add('vrn');
    if (emIframe) raiz.classList.add('vrn-iframe');
    raiz.setAttribute('aria-labelledby', 'vrn-titulo');

    var h = '<p class="vrn-chapeu">' + cfg.chapeu + '</p><p class="vrn-titulo" id="vrn-titulo">' + cfg.titulo + '</p>';
    if (cfg.subtitulo) h += '<p class="vrn-sub">' + cfg.subtitulo + '</p>';
    h += '<div class="vrn-controles"><div class="vrn-abas" role="group" aria-label="Escolha o recorte">';
    cfg.passos.forEach(function (p, i) {
      h += '<button type="button" class="vrn-aba" data-passo="' + i + '" aria-pressed="' + (i === 0) + '">' + p.aba + '<span class="vrn-progresso"></span></button>';
    });
    h += '</div><button type="button" class="vrn-rever" aria-label="Rever a animação desde o início">' +
      '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 8a5.5 5.5 0 1 0 1.7-4"/><path d="M2.5 2.5v3h3"/></svg>' +
      '<span>Rever</span></button></div>';
    h += '<div class="vrn-paineis">' + cfg.passos.map(function (p, i) { return '<div class="vrn-painel' + (i ? '' : ' ativo') + '">' + p.painel + '</div>'; }).join('') + '</div>';
    h += '<div class="vrn-palco"><div class="vrn-dica" role="presentation"></div>' +
      cfg.passos.map(function (p, i) { return '<div class="vrn-camada' + (i ? '' : ' ativa') + '" aria-hidden="true"></div>'; }).join('') + '</div>';
    h += '<div class="vrn-legendas">' + cfg.passos.map(function (p, i) { return '<p class="vrn-legenda' + (i ? '' : ' ativo') + '">' + (p.legenda || '') + '</p>'; }).join('') + '</div>';
    h += '<div class="vrn-tabela" id="vrn-tabela">' + tabelaHtml(cfg.tabela) + '</div>';
    h += '<figcaption><p>' + cfg.fonte + '</p><div class="vrn-acoes">' +
      '<button type="button" class="vrn-btn-tabela" aria-expanded="false" aria-controls="vrn-tabela">Ver os números em tabela</button>' +
      '<img class="vrn-logo" width="126" height="14" alt="Vila Rica News" src="../comum/logo-vrn.png"></div></figcaption>';
    raiz.innerHTML = h;

    var abas = raiz.querySelectorAll('.vrn-aba');
    var paineis = raiz.querySelectorAll('.vrn-painel');
    var legendas = raiz.querySelectorAll('.vrn-legenda');
    var camadas = raiz.querySelectorAll('.vrn-camada');
    var palco = raiz.querySelector('.vrn-palco');
    var dica = raiz.querySelector('.vrn-dica');
    var caixaTabela = raiz.querySelector('.vrn-tabela');
    var btnTabela = raiz.querySelector('.vrn-btn-tabela');
    var vis = cfg.passos.map(function (p, i) { return TIPOS[p.vis.tipo](camadas[i], p.vis, reduzido); });
    var atual = 0;

    // Altura do palco: no iframe, o que sobra da altura do iframe; solto na página, proporcional à largura
    function layout() {
      // com a tabela aberta, ela ocupa o espaço do gráfico (no iframe, a altura que sobra)
      if (raiz.classList.contains('vrn-com-tabela')) {
        if (!emIframe) { caixaTabela.style.height = ''; return; }
        caixaTabela.style.height = '1px';
        var sobra = raiz.getBoundingClientRect().height - 1;
        caixaTabela.style.height = Math.max(120, Math.floor(window.innerHeight - sobra - 2)) + 'px';
        return;
      }
      var W = palco.clientWidth, H;
      if (emIframe) {
        // 1px e não 0: com altura zero as margens de cima e de baixo do palco se fundem e a conta erra
        palco.style.height = '1px';
        var resto = raiz.getBoundingClientRect().height - 1;
        H = Math.max(200, Math.floor(window.innerHeight - resto - 2));
      } else {
        H = Math.round(Math.max(240, Math.min(420, W * 0.6)));
      }
      palco.style.height = H + 'px';
      vis.forEach(function (v) { v.desenhar(W, H); });
    }

    function contar(e, animar) {
      var alvo = parseFloat(e.dataset.conta);
      var casas = parseInt(e.dataset.casas || '0', 10);
      var sufixo = e.dataset.sufixo || '';
      var op = { minimumFractionDigits: casas, maximumFractionDigits: casas };
      if (!animar || reduzido) { e.textContent = alvo.toLocaleString('pt-BR', op) + sufixo; return; }
      var inicio = null;
      function quadro(t) {
        if (!inicio) inicio = t;
        var k = Math.min(1, (t - inicio) / 1100), x = alvo * (1 - Math.pow(1 - k, 3));
        x = casas ? Math.round(x * 10) / 10 : Math.round(x);
        e.textContent = x.toLocaleString('pt-BR', op) + sufixo;
        if (k < 1) requestAnimationFrame(quadro);
      }
      requestAnimationFrame(quadro);
    }

    var saidas = {};
    function irPara(i, animar) {
      atual = i;
      esconderDica();
      abas.forEach(function (a, k) { a.setAttribute('aria-pressed', k === i ? 'true' : 'false'); });
      paineis.forEach(function (p, k) {
        p.classList.toggle('ativo', k === i);
        if (k === i) p.querySelectorAll('[data-conta]').forEach(function (e) { contar(e, animar); });
      });
      legendas.forEach(function (l, k) { l.classList.toggle('ativo', k === i); });
      camadas.forEach(function (c, k) { c.classList.toggle('ativa', k === i); });
      vis.forEach(function (v, k) {
        clearTimeout(saidas[k]);
        if (k === i) v.entrar(animar);
        else saidas[k] = setTimeout(v.sair, 320); // some depois do esmaecer, para animar de novo na volta
      });
    }

    // Reprodução automática: uma vez, ao aparecer na tela; para no último passo
    var timer = null, rodando = false;
    function zerarProgresso() {
      raiz.querySelectorAll('.vrn-progresso').forEach(function (b) { b.style.transition = 'none'; b.style.width = '0'; });
    }
    function progresso(i) {
      zerarProgresso();
      var b = abas[i].querySelector('.vrn-progresso');
      void b.offsetWidth;
      b.style.transition = 'width ' + DURACAO_PASSO + 'ms linear';
      b.style.width = '100%';
    }
    function parar() { rodando = false; clearTimeout(timer); zerarProgresso(); }
    function tocar() {
      parar();
      rodando = true;
      vis.forEach(function (v) { v.sair(); });
      var i = 0;
      function proximo() {
        if (!rodando) return;
        irPara(i, true);
        if (i < abas.length - 1) {
          progresso(i);
          timer = setTimeout(function () { i++; proximo(); }, DURACAO_PASSO);
        } else {
          rodando = false;
          zerarProgresso();
        }
      }
      timer = setTimeout(proximo, 120);
    }
    abas.forEach(function (a) { a.addEventListener('click', function () { parar(); irPara(+a.dataset.passo, true); }); });
    raiz.querySelector('.vrn-rever').addEventListener('click', function () { if (reduzido) irPara(0, false); else tocar(); });

    // Botão da tabela: troca o gráfico pela tabela e volta
    btnTabela.addEventListener('click', function () {
      var abrir = !raiz.classList.contains('vrn-com-tabela');
      parar();
      esconderDica();
      raiz.classList.toggle('vrn-com-tabela', abrir);
      btnTabela.setAttribute('aria-expanded', abrir ? 'true' : 'false');
      btnTabela.textContent = abrir ? 'Voltar ao gráfico' : 'Ver os números em tabela';
      layout();
      if (!abrir) irPara(atual, false);
    });

    // Dica ao passar o mouse ou tocar
    function mostrarDica(ev) {
      var a = vis[atual].alvo(ev);
      if (!a) { esconderDica(); return; }
      dica.innerHTML = a.html;
      dica.classList.add('on');
      var rp = palco.getBoundingClientRect();
      var meia = dica.offsetWidth / 2;
      dica.style.left = Math.max(meia, Math.min(rp.width - meia, a.x - rp.left)) + 'px';
      dica.style.top = (a.y - rp.top) + 'px';
      vis[atual].destacar(a.chave);
    }
    function esconderDica() {
      dica.classList.remove('on');
      vis.forEach(function (v) { v.destacar(null); });
    }
    palco.addEventListener('pointermove', mostrarDica);
    palco.addEventListener('pointerdown', mostrarDica);
    palco.addEventListener('pointerleave', function (ev) { if (ev.pointerType !== 'touch') esconderDica(); });
    document.addEventListener('pointerdown', function (ev) { if (!palco.contains(ev.target)) esconderDica(); });

    layout();
    // a fonte da marca chega depois e muda a altura dos textos: refaz a conta
    if (document.fonts) {
      if (document.fonts.ready) document.fonts.ready.then(layout);
      if (document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', layout);
    }
    // no iframe, se a altura do conteúdo mudar por qualquer motivo, reajusta o palco
    if (emIframe && window.ResizeObserver) {
      new ResizeObserver(function () {
        if (Math.abs(raiz.getBoundingClientRect().height - (window.innerHeight - 2)) > 1) layout();
      }).observe(raiz);
    }
    var tamanho = palco.clientWidth + 'x' + window.innerHeight;
    window.addEventListener('resize', function () {
      var t = palco.clientWidth + 'x' + window.innerHeight;
      if (t === tamanho) return;
      tamanho = t;
      layout();
    });

    // Quando embutido por iframe, avisa a página da altura (útil se o site aceitar script)
    function avisarAltura() {
      if (!emIframe) return;
      window.parent.postMessage({ tipo: 'vrn-altura', grafico: cfg.id || '', altura: Math.ceil(document.documentElement.scrollHeight) }, '*');
    }
    if (window.ResizeObserver) new ResizeObserver(avisarAltura).observe(raiz); else window.addEventListener('load', avisarAltura);

    if (reduzido || !('IntersectionObserver' in window)) {
      irPara(0, false);
    } else {
      var obs = new IntersectionObserver(function (en) {
        if (en[0].isIntersecting) { obs.disconnect(); tocar(); }
      }, { threshold: 0.45 });
      obs.observe(raiz);
    }
  }

  window.VRN = { grafico: grafico, n: n, pct: pct, soma: soma };
})();
