
import { LitElement, html, css } from 'lit';

export type SidebarProps = {
  closed?: boolean,
  content?: HTMLElement | ''
}


const collapseThreshold = 600

export class Sidebar extends LitElement {

  closed: SidebarProps['closed']
  content: SidebarProps['content'] = ''
  
  interacted: boolean = false


  static get styles() {
    return css`

    
    :host {

      --collapse-width: ${collapseThreshold}px;
      --dark-color: rgb(25, 25, 25);
      --light-color: rgb(240, 240, 240);

      --blue-spiral: repeating-linear-gradient(
        45deg,
        rgb(30, 167, 253),
        rgb(30, 167, 253) 10px,
        rgb(118, 222, 255) 10px,
        rgb(118, 222, 255) 20px
      );

      /* Light Hue: 118, 222, 255 */
      /* Dark Hue: 0, 116, 196 */

      --light-spiral: repeating-linear-gradient(
        45deg,
        rgb(190, 190, 190),
        rgb(190, 190, 190) 10px,
        rgb(240, 240, 240) 10px,
        rgb(240, 240, 240) 20px
      );

      --dark-spiral: repeating-linear-gradient(
        45deg,
        rgb(25, 25, 25),
        rgb(25, 25, 25) 10px,
        rgb(75, 75, 75) 10px,
        rgb(75, 75, 75) 20px
      );

      --final-toggle-width: 15px;

      color: black;
      grid-area: side;
      background: var(--light-color);
      position: relative;
      display: flex;
      overflow: hidden;
      max-width: 50vw;
    }


    :host > * {
      box-sizing: border-box;
    }

    :host([closed]) > #main {
        width: 0px;
        overflow: hidden;
    }

    :host([closed]) > #toggle {
      width: var(--final-toggle-width);
    }

    #main {
      overflow: hidden;
    }

    #toggle:hover { 
      background: var(--blue-spiral)
    }

    .hidden {
      display: none;
    }

    #toggle {
      height: 100%;
      width: 10px;
      background: rgb(25, 25, 25);
      cursor: pointer;
      background: var(--light-spiral);
      border:none;
    }

    #toggle:active {
      background: var(--blue-spiral)
    }

    #controls {
      overflow-x: hidden;
      overflow-y: scroll;
      height: 100%;
    }

    @media only screen and (max-width: ${collapseThreshold}px) {
      :host {
        max-width: 100%;
      }

      :host(.default) > #main {
          width: 0px;
          overflow: hidden;
      }

      :host(.default) > #toggle {
        width: var(--final-toggle-width);
      }
    }


    #toggle {
      position: sticky;
      left:0;
      top: 0;
    }

    @media (prefers-color-scheme: dark) {
      :host {
        color: white;
        background: var(--dark-color);
      }

      #toggle {
        background: var(--dark-spiral)
      }
    }

    `;
  }
    
    static get properties() {
      return {
        closed: {
          type: Boolean,
          reflect: true
        },
        content: {
          type: Object,
          reflect: true
        },
      };
    }

    constructor(props: SidebarProps = {}) {
      super()

      this.closed = props.closed
      this.classList.add('default')
    }
  
    render() {
      
      const renderToggle = this.content || this.children?.length // Note: May also need to check the slot generally...

      return html`
        <button id=toggle class="${!!renderToggle ? '' : 'hidden'}" @click=${() => {
              const wasDefault = this.classList.contains('default')
              this.classList.remove('default') // Closed only added after user interaction
              if (window.innerWidth < collapseThreshold){
                if (!wasDefault) this.closed = !this.closed // Closed only added after user interaction
              } else this.closed = !this.closed // Closed only added after user interaction
        }}></button>
        <div id=main>
          <div id=controls>
          ${this.content}
          <slot></slot>
          </div>
        </div>
      `
    }
  }
  
  customElements.get('visualscript-sidebar') || customElements.define('visualscript-sidebar',  Sidebar);