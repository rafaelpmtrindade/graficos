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
  // v.estados: abas que compartilham os mesmos pontos (eles mudam de cor de uma aba para outra)
  function Pontos(camada, v, reduzido) {
    var estados = v.estados || [v.grupos];
    var N = soma(estados[0], 'pontos');
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    camada.appendChild(svg);
    var pts = [], grupoDe = [], estado = -1, pulso = null;
    for (var k = 0; k < N; k++) {
      var c = document.createElementNS(NS, 'circle');
      c.setAttribute('r', 8);
      c.setAttribute('class', 'vrn-ponto');
      svg.appendChild(c);
      pts.push(c);
    }
    function aplicarEstado(e, animar) {
      grupoDe = [];
      estados[e].forEach(function (g) { for (var j = 0; j < g.pontos; j++) grupoDe.push(g); });
      clearTimeout(pulso);
      pts.forEach(function (p, i) {
        p.style.transitionDelay = animar && !reduzido ? (+p.dataset.col * 28 + +p.dataset.lin * 6) + 'ms' : '0ms';
        p.style.setProperty('--cor', grupoDe[i].cor);
        p.classList.toggle('vazado', !!grupoDe[i].vazado);
        p.classList.remove('pulsa');
      });
      estado = e;
      // grupos marcados com "pulsar" pulsam depois de mudar de cor
      var pulsam = pts.filter(function (p, i) { return grupoDe[i].pulsar; });
      if (pulsam.length && !reduzido) pulso = setTimeout(function () {
        pulsam.forEach(function (p) { p.style.transitionDelay = '0ms'; p.classList.add('pulsa'); });
      }, animar ? 900 : 300);
    }
    aplicarEstado(0, false);
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
      entrar: function (animar, e) {
        e = e || 0;
        if (pts[0].classList.contains('visivel')) {
          if (e !== estado) aplicarEstado(e, animar); // já na tela: só muda as cores
          return;
        }
        aplicarEstado(e, false);
        pts.forEach(function (p) {
          p.style.transitionDelay = animar && !reduzido ? (+p.dataset.col * 30 + +p.dataset.lin * 8) + 'ms' : '0ms';
          p.classList.add('visivel');
        });
      },
      sair: function () {
        clearTimeout(pulso);
        pts.forEach(function (p) { p.style.transitionDelay = '0ms'; p.classList.remove('visivel', 'pulsa'); });
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
  // Opcionais: l.partes [{valor, cor}] divide a barra (o número na ponta é a soma);
  // v.trilho (cor) desenha o fundo da barra até v.max, para mostrar a parte de um todo;
  // v.formato(valor) escreve o número da ponta.
  function Barras(camada, v, reduzido) {
    var box = document.createElement('div');
    box.className = 'vrn-barras' + (v.trilho ? ' vrn-barras--trilho' : '');
    if (v.trilho) box.style.setProperty('--vrn-trilho-cor', v.trilho);
    camada.appendChild(box);
    var formato = v.formato || n;
    function total(l) { return l.partes ? soma(l.partes, 'valor') : l.valor; }
    var max = v.max || Math.max.apply(null, v.linhas.map(total));
    var linhas = v.linhas.map(function (l) {
      var row = document.createElement('div');
      row.className = 'vrn-barra';
      var fillHtml = l.partes
        ? '<div class="vrn-barra-fill vrn-barra-partes">' + l.partes.map(function (p) {
            return '<i style="--cor:' + p.cor + ';flex-grow:' + p.valor + '"></i>';
          }).join('') + '</div>'
        : '<div class="vrn-barra-fill"></div>';
      row.innerHTML = '<div class="vrn-barra-rotulo">' + l.rotulo + (l.extra ? '<span>' + l.extra + '</span>' : '') + '</div>' +
        '<div class="vrn-barra-linha">' + fillHtml + '<div class="vrn-barra-valor">' + formato(total(l)) + '</div></div>';
      var fill = row.querySelector('.vrn-barra-fill');
      if (!l.partes) fill.style.setProperty('--cor', l.cor);
      box.appendChild(row);
      return { row: row, fill: fill, dados: l, valor: total(l) };
    });
    var util = 0;
    function largura(o) { o.fill.style.width = Math.max(2, o.valor / max * util) + 'px'; }

    return {
      desenhar: function (W, H) {
        // linhas encolhem até 26px quando falta altura (celular estreito); abaixo de 32px, letra menor
        var alt = Math.max(26, Math.min(60, H / linhas.length));
        box.classList.toggle('vrn-compacto', alt < 32);
        box.style.setProperty('--vrn-linha', alt + 'px');
        box.style.setProperty('--vrn-espessura', Math.max(8, Math.min(22, Math.round(alt * 0.36))) + 'px');
        util = Math.max(40, W - 64); // sobra para o número na ponta
        box.style.setProperty('--vrn-util', util + 'px');
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

  // ---------- Peças comuns às séries por hora (colunas e linhas) ----------
  function novoEl(pai, nome, attrs, texto) {
    var e = document.createElementNS(NS, nome);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (texto != null) e.textContent = texto;
    pai.appendChild(e);
    return e;
  }
  function plano(camada) {
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('class', 'vrn-plano');
    camada.appendChild(svg);
    return svg;
  }
  // faixa clara de fundo (ex.: urnas abertas), da coluna "de" até a coluna "ate"
  function desenharFaixa(svg, f, esq, banda, topo, ph) {
    if (!f) return;
    var xa = esq + f.de * banda, xf = esq + (f.ate + 1) * banda;
    novoEl(svg, 'rect', { x: xa, y: topo - 26, width: xf - xa, height: ph + 26, 'class': 'vrn-faixa' });
    novoEl(svg, 'text', { x: xa + 8, y: topo - 9, 'class': 'vrn-faixa-rotulo' }, f.rotulo);
  }

  // ---------- Colunas: uma por hora (ou etapa em sequência) ----------
  // v.linhas: [{rotulo, valor, cor, dica}]; v.max; v.grade: [valores com linha]; v.formato(valor); v.marcar: índices com número mesmo em tela estreita
  function Colunas(camada, v, reduzido) {
    var svg = plano(camada), L = v.linhas;
    var max = v.max || Math.max.apply(null, L.map(function (l) { return l.valor; }));
    var fmt = v.formato || n, barras = [], geo = null, dentro = false;
    function mostrar(b, i, animar) {
      var atraso = animar && !reduzido ? i * 45 : 0;
      b.r.style.transitionDelay = atraso + 'ms';
      b.r.classList.add('visivel');
      if (b.val) { b.val.style.transitionDelay = (atraso + 350) + 'ms'; b.val.classList.add('visivel'); }
    }
    return {
      desenhar: function (W, H) {
        while (svg.firstChild) svg.removeChild(svg.firstChild);
        var esq = 40, dir = 4, topo = v.faixa ? 36 : 22, baixo = 24;
        var pw = W - esq - dir, ph = Math.max(60, H - topo - baixo), banda = pw / L.length;
        svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
        var y = function (val) { return topo + ph - val / max * ph; };
        desenharFaixa(svg, v.faixa, esq, banda, topo, ph);
        (v.grade || []).forEach(function (g) {
          novoEl(svg, 'line', { x1: esq, x2: esq + pw, y1: y(g), y2: y(g), 'class': 'vrn-grade' });
          novoEl(svg, 'text', { x: esq - 6, y: y(g) + 4, 'text-anchor': 'end', 'class': 'vrn-eixo' }, fmt(g));
        });
        var todos = banda >= 34, passoX = banda >= 30 ? 1 : 2;
        barras = L.map(function (l, i) {
          var bw = Math.min(28, banda * 0.62), x = esq + i * banda + (banda - bw) / 2, yv = y(l.valor);
          var r = novoEl(svg, 'rect', { x: x, y: yv, width: bw, height: Math.max(1, topo + ph - yv), rx: 3, 'class': 'vrn-col' });
          r.style.setProperty('--cor', l.cor || 'var(--vrn-cinza)');
          r.style.transformOrigin = (x + bw / 2) + 'px ' + (topo + ph) + 'px';
          var val = (todos || (v.marcar || []).indexOf(i) >= 0) ? novoEl(svg, 'text', { x: x + bw / 2, y: yv - 6, 'text-anchor': 'middle', 'class': 'vrn-col-valor' }, fmt(l.valor)) : null;
          if (i % passoX === 0) novoEl(svg, 'text', { x: x + bw / 2, y: topo + ph + 17, 'text-anchor': 'middle', 'class': 'vrn-eixo' }, l.rotulo);
          return { r: r, val: val, dados: l, cx: x + bw / 2, y: yv };
        });
        novoEl(svg, 'line', { x1: esq, x2: esq + pw, y1: topo + ph, y2: topo + ph, 'class': 'vrn-base' });
        geo = { esq: esq, banda: banda };
        if (dentro) barras.forEach(function (b, i) { mostrar(b, i, false); });
      },
      entrar: function (animar) { dentro = true; barras.forEach(function (b, i) { mostrar(b, i, animar); }); },
      sair: function () {
        dentro = false;
        barras.forEach(function (b) { b.r.style.transitionDelay = '0ms'; b.r.classList.remove('visivel'); if (b.val) { b.val.style.transitionDelay = '0ms'; b.val.classList.remove('visivel'); } });
      },
      alvo: function (ev) {
        if (!geo) return null;
        var rc = svg.getBoundingClientRect(), i = Math.floor((ev.clientX - rc.left - geo.esq) / geo.banda);
        var b = barras[i];
        if (!b) return null;
        return { chave: b, html: b.dados.dica, x: rc.left + b.cx, y: rc.top + b.y };
      },
      destacar: function (chave) { barras.forEach(function (b) { b.r.classList.toggle('vrn-apagado', !!chave && b !== chave); }); }
    };
  }

  // ---------- Linhas: uma ou duas séries por hora ----------
  // v.rotulos; v.series: [{nome, cor, valores}]; v.min, v.max; v.grade; v.formato; v.dicas[i]; v.marcar: [{serie, i, abaixo}]
  function Linhas(camada, v, reduzido) {
    var svg = plano(camada), N = v.rotulos.length, fmt = v.formato || n;
    var caminhos = [], marcas = [], guia = null, geo = null, dentro = false;
    function mostrar(animar) {
      caminhos.forEach(function (c) { c.style.transitionDuration = animar && !reduzido ? '' : '0s'; c.classList.add('visivel'); });
      marcas.forEach(function (m) { m.style.transitionDelay = animar && !reduzido ? '' : '0s'; m.classList.add('visivel'); });
    }
    return {
      desenhar: function (W, H) {
        while (svg.firstChild) svg.removeChild(svg.firstChild);
        var esq = 40, dir = 8, topo = v.faixa ? 36 : 22, baixo = 24;
        var pw = W - esq - dir, ph = Math.max(60, H - topo - baixo), banda = pw / N;
        svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
        var x = function (i) { return esq + (i + 0.5) * banda; };
        var y = function (val) { return topo + ph - (val - v.min) / (v.max - v.min) * ph; };
        desenharFaixa(svg, v.faixa, esq, banda, topo, ph);
        (v.grade || []).forEach(function (g) {
          novoEl(svg, 'line', { x1: esq, x2: esq + pw, y1: y(g), y2: y(g), 'class': 'vrn-grade' });
          novoEl(svg, 'text', { x: esq - 6, y: y(g) + 4, 'text-anchor': 'end', 'class': 'vrn-eixo' }, fmt(g, true));
        });
        var passoX = banda >= 30 ? 1 : 2;
        v.rotulos.forEach(function (r, i) { if (i % passoX === 0) novoEl(svg, 'text', { x: x(i), y: topo + ph + 17, 'text-anchor': 'middle', 'class': 'vrn-eixo' }, r); });
        guia = novoEl(svg, 'line', { x1: 0, x2: 0, y1: topo - 4, y2: topo + ph, 'class': 'vrn-guia' });
        caminhos = v.series.map(function (s) {
          var d = s.valores.map(function (val, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(val).toFixed(1); }).join(' ');
          var c = novoEl(svg, 'path', { d: d, pathLength: 1, 'class': 'vrn-lin' });
          c.style.setProperty('--cor', s.cor);
          return c;
        });
        marcas = [];
        (v.marcar || []).forEach(function (m) {
          var s = v.series[m.serie], cx = x(m.i), cy = y(s.valores[m.i]);
          var p = novoEl(svg, 'circle', { cx: cx, cy: cy, r: 5, 'class': 'vrn-lin-ponto' });
          p.style.setProperty('--cor', s.cor);
          var t = novoEl(svg, 'text', { x: cx, y: m.abaixo ? cy + 20 : cy - 10, 'text-anchor': 'middle', 'class': 'vrn-lin-rotulo' }, fmt(s.valores[m.i]));
          marcas.push(p, t);
        });
        geo = { esq: esq, banda: banda, x: x, y: y };
        if (dentro) mostrar(false);
      },
      entrar: function (animar) { dentro = true; mostrar(animar); },
      sair: function () {
        dentro = false;
        caminhos.concat(marcas).forEach(function (e) { e.style.transitionDuration = '0s'; e.style.transitionDelay = '0s'; e.classList.remove('visivel'); });
      },
      alvo: function (ev) {
        if (!geo) return null;
        var rc = svg.getBoundingClientRect(), i = Math.floor((ev.clientX - rc.left - geo.esq) / geo.banda);
        if (i < 0 || i >= N) return null;
        var topoSerie = Math.min.apply(null, v.series.map(function (s) { return geo.y(s.valores[i]); }));
        return { chave: i, html: v.dicas[i], x: rc.left + geo.x(i), y: rc.top + topoSerie - 6 };
      },
      destacar: function (chave) {
        if (!guia) return;
        if (chave == null) { guia.classList.remove('on'); return; }
        guia.setAttribute('x1', geo.x(chave)); guia.setAttribute('x2', geo.x(chave)); guia.classList.add('on');
      }
    };
  }

  var TIPOS = { pontos: Pontos, barras: Barras, piramide: Piramide, colunas: Colunas, linhas: Linhas };

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

    // Abas com o mesmo vis.compartilhar usam os mesmos pontos, que só mudam de cor
    var juntos = {}, defs = [];
    var mapa = cfg.passos.map(function (p) {
      var chave = p.vis.compartilhar;
      if (chave) {
        if (!juntos[chave]) { juntos[chave] = { camada: defs.length, def: { tipo: 'pontos', colunas: p.vis.colunas, estados: [] } }; defs.push(juntos[chave].def); }
        juntos[chave].def.estados.push(p.vis.grupos);
        return { camada: juntos[chave].camada, estado: juntos[chave].def.estados.length - 1 };
      }
      defs.push(p.vis);
      return { camada: defs.length - 1, estado: 0 };
    });

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
      defs.map(function (d, i) { return '<div class="vrn-camada' + (i ? '' : ' ativa') + '" aria-hidden="true"></div>'; }).join('') + '</div>';
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
    var vis = defs.map(function (d, i) { return TIPOS[d.tipo](camadas[i], d, reduzido); });
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
      var alvo = mapa[i];
      camadas.forEach(function (c, k) { c.classList.toggle('ativa', k === alvo.camada); });
      vis.forEach(function (v, k) {
        clearTimeout(saidas[k]);
        if (k === alvo.camada) v.entrar(animar, alvo.estado);
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
      var v = vis[mapa[atual].camada], a = v.alvo(ev);
      if (!a) { esconderDica(); return; }
      dica.innerHTML = a.html;
      dica.classList.add('on');
      var rp = palco.getBoundingClientRect();
      var meia = dica.offsetWidth / 2;
      dica.style.left = Math.max(meia, Math.min(rp.width - meia, a.x - rp.left)) + 'px';
      dica.style.top = (a.y - rp.top) + 'px';
      v.destacar(a.chave);
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
