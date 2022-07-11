
import { LitElement, html, css } from 'lit';
import {until} from 'lit-html/directives/until.js';
import { TreeItem } from './TreeItem';

type keyType = string
export type TreeProps = {
  target: {[x:string]: any}
  depth?: number,
  onClick?: Function
}

export class Tree extends LitElement {

  static get styles() {
    return css`

    :host * {
      box-sizing: border-box;
    }

    :host > div {
      background: white;
      height: 100%;
      width: 100%;
    }

    ul {
        list-style-type: none;
        padding: 0;
        margin: 0;
        font-size: 90%;
    }

    .container {
      width: 100%;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: scroll;
      height: 100%;
    }

    .info {
      display: flex;
      align-items: center;
    }

    .name {
      padding-right: 10px;
    }

    .value {
      font-size: 80%;
    }

    #header {
      display: flex;
      overflow-x: scroll;
      align-items: center;
      justify-content: flex-end;
    }

    visualscript-icon {
      width: 18px;
      height: 18px;
      padding; 10px;
      cursor: pointer;
    }

    @media (prefers-color-scheme: dark) {
      :host > * {
        background-color: rgb(40, 40, 40);
      }
    }

    `;
  }
    
    static get properties() {
      return {
        // target: {
        //   type: Object,
        //   reflect: false,
        // },
        keys: {
          type: Object,
          reflect: true,
        },
        depth: {
          type: Number,
          reflect: true,
        },
        onClick: {
          type: Function,
          reflect: true,
        },
        input: {
          type: Boolean
        }
      };
    }

    target: TreeProps['target']
    onClick: TreeProps['onClick']
    keys: (keyType)[]
    depth: TreeProps['depth'] = 0
    items: TreeItem[] = []
    input: TreeItem
    oncreate: Function


    constructor(props: TreeProps = {target: {}}) {
      super();

      if (props.depth) this.depth = props.depth
      if (props.onClick) this.onClick = props.onClick

      this.set(props.target)

      window.addEventListener('click', (ev:any) => {
        const hasTree = ev.path.find(el => el === this)

        const drill = (o) => {
          o.items.forEach(item => {
            if (item.li && !item.li.classList.contains('last')) item.removeClass('selected')
            if (item.tree) drill(item.tree)
          })
        }
        
        if (!hasTree) drill(this)
      })
    }

    set = async (target={}) => {
      this.target = target
      this.keys = Object.keys(this.target)
    }

    createItem = (type, key?, value?) => {
      const treeItem = new TreeItem({
        key,
        type,
        value,
        parent: this,
        onClick: this.onClick
      })

      return treeItem
    }

    getElement = async (key:keyType, o: any) => {

      const value = o[key]
      let type = (value.constructor.name === 'Object') ? 'folder' : 'file'
      return this.createItem(type, key, value)
    }

    add = (key ,value) => {
      this.set(Object.assign({[key]: value}, this.target)) // reset target
    }

    create = async (type, targetTree?:Tree) => {
      if (this === targetTree) {
        this.input = targetTree.createItem(type)
        await this.input.ready

        console.log(type, this.oncreate)
        let value = (this.oncreate instanceof Function) ? await this.oncreate(type,  this.input) : undefined
        if (value == undefined && type === 'folder') value = {} // Correct folders

        this.add(this.input.key, value)
        this.input = undefined
      } else {
        const targetTree = ((this.querySelector('.last') as TreeItem)?.parent ?? this)
        targetTree.create(type, targetTree)
      }
    }
  
    render() {
      const content = (this.keys?.map(key => {
        return this.getElement(key, this.target)
      }))

      return until(Promise.all(content).then((data) => {

        this.items = data

        return html`
        <div>
        ${this.depth === 0 ? html`
          <div id=header>
          <visualscript-icon type="newFile" @click=${()=>{
            this.create('file')
          }}></visualscript-icon>
          <visualscript-icon type="newFolder" @click=${()=>{
            this.create('folder')
          }}></visualscript-icon>
        </div>
      ` : ''}
          <ul class="container">
                ${data}
                ${this.input}
          </ul>
        </div>
      `
      }), html`<span>Loading...</span>`)

    }
  }
  
  customElements.define('visualscript-tree', Tree);