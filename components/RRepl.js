import { WebR } from 'webr';
import Plotly from 'plotly.js-dist-min'


export default class RRepl {
  #webR; #outputSelector;

  constructor(webR, outputSelector) {
    this.#webR = webR;
    this.#outputSelector = outputSelector;
  }

  static async initialize(outputElem) {
    const webR = await this.#initializeWebR();
    const res = new RRepl(webR, outputElem);
    await res.onScreenUpdate();
    return res;
  }

  async eval(rCode, table, viewOnly = false) {
    try {
      await this.onScreenUpdate();
      if (!viewOnly) {
        await this.onDataUpdate(table);
      }
      return await this.#recreatePlot(rCode);
    } catch (e) {
      return { error: e }
    }
  }

  minimalRCode() {
    return `theme_set(theme_bw())

### the current table is bound to the variable 'data'
output <- ggplot(data, aes()) +
  annotate(geom = 'text', x = 0, y = 0, label = 'Plot something!')

## output to the html page
plotly_json(output, pretty=FALSE)
`
  }

  // private methods

  static async #initializeWebR() {
    const webR = new WebR();
    await webR.init();
    await webR.installPackages(['ggplot2', 'svglite', 'plotly'], { quiet: true, mount: true });
    await webR.evalRVoid("library(svglite); library(plotly); library(ggplot2);");
    return webR;
  }

  async #recreatePlot(code) {
    if (!code) {
      return { error: 'No code provided. Type some R code above!' };
    }
    // const svgstr = await this.#webR.evalRString(code);
    // $(this.#outputSelector).html(svgstr);

    const plotlyData = await this.#webR.evalRString(code);
    Plotly.react(this.#outputSelector, JSON.parse(plotlyData), {});
    return { svg: document.getElementById(this.#outputSelector).getElementsByTagName('svg')[0].outerHTML };
  }

  async onDataUpdate(table) {
    await this.#webR.objs.globalEnv.bind('data', table.rows);
    console.log('bound new table to R:', table);
    await this.#webR.evalR('print(head(data))');
  }

  async onScreenUpdate() {
    try {
      let elem = document.getElementById(this.#outputSelector);
      let w = elem.clientWidth;
      w = w == 0  ? 0.9 * window.innerWidth : w;
      let h = window.innerHeight/2;
      await this.#webR.objs.globalEnv.bind('output.width.inch', w/96);
      await this.#webR.objs.globalEnv.bind('output.height.inch', h/96);
      if (elem.data) { // re-layout if plot already exists
        Plotly.relayout(this.#outputSelector, { height: h, width: w });
      }
      // console.log('bound output size to R:', w, h);
    } catch (e) {
      console.error("failed to re-bind or re-draw data", e);
    }
  }
}
