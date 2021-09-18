import { VG } from "../../config.js";

/*
 * @extends {ItemSheet}
 */
export class VGItemSheet extends ItemSheet {

    /** @override */
    static get defaultOptions() {
      return mergeObject(super.defaultOptions, {
        classes: ["vastgrimm", "sheet", "item"],
        width: 730,
        height: 680,
        tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "data"}],
        dragDrop: [{dragSelector: ".item-list .item", dropSelector: null}]
      });
    }
  
    /** @override */
    get template() {
      const path = "systems/vastgrimm/templates/item";
      if (["cargo", "hubModule"].includes(this.item.data.type)) {
        // specific item-type sheet
        return `${path}/${this.item.data.type}-sheet.html`;
      } else {
        // generic item sheet
        return `${path}/item-sheet.html`;
      }
    }

    /** @override */
    activateListeners(html) {
      super.activateListeners(html);
    }
  }
  