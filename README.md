# Gráficos do Vila Rica News

Gráficos interativos para embutir nas matérias do [Vila Rica News](https://vilaricanews.com.br).
Cada gráfico fica numa pasta e todos usam o motor comum em `comum/` (`vrn.js` + `vrn.css`) e é publicado pelo GitHub Pages em
`https://rafaelpmtrindade.github.io/graficos/<pasta>/`.

| Pasta | Matéria | Altura do iframe |
|---|---|---|
| `eleitorado-2026` | Quem são os 13.883 eleitores de Vila Rica? (TSE, Perfil do Eleitorado 2026) | 750px |
| `idade-2026` | Quase um em cada cinco eleitores de Vila Rica tem 60 anos ou mais | 700px |
| `locais-de-votacao-2026` | Quatro locais concentram quase 86% do eleitorado de Vila Rica | 730px |
| `genero-2026` | Homens são maioria entre os eleitores de Vila Rica | 740px |
| `tempo-eleicao-2026` | Domingo de eleição deve ter calor forte e chuva no fim do dia em Vila Rica (previsão de 03/10) | 780px |
| `deputado-estadual-2026` | Abmael Borges repete marca de Janovan Rios em Vila Rica: 4 em cada 10 votos e a suplência | 700px |

## Como embutir

No editor da matéria, em **Código-fonte**:

```html
<iframe src="https://rafaelpmtrindade.github.io/graficos/eleitorado-2026/" title="O eleitorado de Vila Rica em pontos" loading="lazy" style="width:100%;border:0;height:750px"></iframe>
```
