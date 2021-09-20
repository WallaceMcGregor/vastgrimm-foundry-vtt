import {VGActor} from "../actor/actor.js";
import {VGItem} from "../item/item.js";
import {randomName} from "./names.js";

export const createRandomScvm = async () => {
    const clazz = await pickRandomClass();
    await createScvm(clazz);
};

export const createScvm = async (clazz) => {
    const scvm = await rollScvmForClass(clazz);
    await createActorWithScvm(scvm);
};

export const scvmifyActor = async (actor, clazz) => {
    const scvm = await rollScvmForClass(clazz);
    await updateActorWithScvm(actor, scvm);
};

const pickRandomClass = async () => {
    const classPacks = findClassPacks();
    if (classPacks.length === 0) {
        // TODO: error on 0-length classPaths
        return;
    }
    const packName = classPacks[Math.floor(Math.random() * classPacks.length)];
    // TODO: debugging hardcodes
    const pack = game.packs.get(packName);
    let content = await pack.getDocuments();
    return content.find(i => i.data.type === "class");
};

export const findClassPacks = () => {
    const classPacks = [];
    const packKeys = game.packs.keys();
    for (const packKey of packKeys) {
        // moduleOrSystemName.packName
        const keyParts = packKey.split(".");
        if (keyParts.length === 2) {
            const packName = keyParts[1];
            if (packName.startsWith("class-") && packName.length > 6) {
                // class pack
                classPacks.push(packKey);
            }
        }
    }
    return classPacks;
};

export const classItemFromPack = async (packName) => { 
    const pack = game.packs.get(packName); 
    const content = await pack.getDocuments(); 
    return content.find(i => i.data.type === "class");
};

const rollScvmForClass = async (clazz) => {
    console.log(`Creating new ${clazz.data.name}`);

    const creditsRoll = new Roll(clazz.data.data.startingCredits).evaluate({async: false});
    const favorsRoll = new Roll(clazz.data.data.favorDie).evaluate({async: false});
    const hpRoll = new Roll(clazz.data.data.startingHitPoints).evaluate({async: false});
    const neuromancyPointsRoll = new Roll("1d4").evaluate({async: false});

    const strRoll = new Roll(clazz.data.data.startingStrength).evaluate({async: false});
    const strength = abilityBonus(strRoll.total);
    const agiRoll = new Roll(clazz.data.data.startingAgility).evaluate({async: false});
    const agility = abilityBonus(agiRoll.total);
    const preRoll = new Roll(clazz.data.data.startingPresence).evaluate({async: false});
    const presence = abilityBonus(preRoll.total);
    const touRoll = new Roll(clazz.data.data.startingToughness).evaluate({async: false});
    const toughness = abilityBonus(touRoll.total);

    const hitPoints = Math.max(1, hpRoll.total + toughness);
    const neuromancyPoints = Math.max(0, neuromancyPointsRoll.total + presence);

    // 3 starting equipment tables
    const ccPack = game.packs.get('vastgrimm.character-creation');
    const ccContent = await ccPack.getDocuments();
    const equipTable1 = ccContent.find(i => i.name === 'Starting Equipment - 1');
    const equipTable2 = ccContent.find(i => i.name === 'Starting Equipment - 2');
    const equipTable3 = ccContent.find(i => i.name === 'Starting Equipment - 3');
    const eqDraw1 = await equipTable1.draw({displayChat: false});
    const eqDraw2 = await equipTable2.draw({displayChat: false});
    const eqDraw3 = await equipTable3.draw({displayChat: false});
    const eq1 = await entitiesFromResults(eqDraw1.results);
    const eq2 = await entitiesFromResults(eqDraw2.results);
    const eq3 = await entitiesFromResults(eqDraw3.results);

    // const ttTable = ccContent.find(i => i.name === 'Terribler Traits');
    // const bbTable = ccContent.find(i => i.name === 'Brokener Bodies');
    // const bhTable = ccContent.find(i => i.name === 'Badder Habits');
    // const ttResults = await compendiumTableDrawMany(ttTable, 2);
    // const bbDraw = await bbTable.draw({displayChat: false});
    // const bhDraw = await bhTable.draw({displayChat: false});
    // const terribleTrait1 = ttResults[0].data.text;
    // const terribleTrait2 = ttResults[1].data.text;
    // const brokenBody = bbDraw.results[0].data.text;
    // const badHabit = bhDraw.results[0].data.text;

    // starting weapon
    let weapons = [];
    if (clazz.data.data.weaponTableDie) {
        const weaponRoll = new Roll(clazz.data.data.weaponTableDie);
        const weaponTable = ccContent.find(i => i.name === 'Weapons Table');
        const weaponDraw = await weaponTable.draw({roll: weaponRoll, displayChat: false});
        weapons = await entitiesFromResults(weaponDraw.results);
    }

    // starting armor
    let armors = [];
    if (clazz.data.data.armorTableDie) {
        const armorRoll = new Roll(clazz.data.data.armorTableDie);
        const armorTable = ccContent.find(i => i.name === 'Armor Table');
        const armorDraw = await armorTable.draw({roll: armorRoll, displayChat: false});
        armors = await entitiesFromResults(armorDraw.results);
    }

    // class-specific starting items
    const startingItems = [];
    if (clazz.data.data.startingItems) {
        const lines = clazz.data.data.startingItems.split("\n");
        for (const line of lines) {
            const [packName, itemName] = line.split(",");
            const pack = game.packs.get(packName);
            if (pack) {
                const content = await pack.getDocuments();
                const item = content.find(i => i.data.name === itemName);
                if (item) {
                    startingItems.push(item);
                }    
            }
        }
    }

    // start accumulating character description, starting with the class description
    const descriptionLines = [];
    descriptionLines.push(clazz.data.data.description);
    // descriptionLines.push("<p>&nbsp;</p>");
    // // BrokenBodies and BadHabits end with a period, but TerribleTraits don't.
    // descriptionLines.push(`${terribleTrait1} and ${terribleTrait2.charAt(0).toLowerCase()}${terribleTrait2.slice(1)}. ${brokenBody} ${badHabit}`);
    // descriptionLines.push("<p>&nbsp;</p>");

    // class-specific starting rolls
    const startingRollItems = [];
    if (clazz.data.data.startingRolls) {
        const lines = clazz.data.data.startingRolls.split("\n");
        for (const line of lines) {
            const [packName, tableName, rolls] = line.split(",");
            // assume 1 roll unless otherwise specified in the csv
            const numRolls = rolls ? parseInt(rolls) : 1;
            const pack = game.packs.get(packName);
            if (pack) {
                const content = await pack.getDocuments();
                const table = content.find(i => i.name === tableName);
                if (table) {
                    // const tableDraw = await table.drawMany(numRolls, {displayChat: false});
                    // const results = tableDraw.results;
                    const results = await compendiumTableDrawMany(table, numRolls);
                    for (const result of results) {
                        // draw result type: text (0), entity (1), or compendium (2)
                        if (result.data.type === 0) {
                            // text
                            descriptionLines.push(`<p>${table.data.name}: ${result.data.text}</p>`);
                        } else if (result.data.type === 1) {
                            // entity
                            // TODO: what do we want to do here?
                        } else if (result.data.type === 2) {
                            // compendium
                            const entity = await entityFromResult(result);
                            startingRollItems.push(entity);
                        }
                    }
                } else {
                    console.log(`Could not find RollTable ${tableName}`);
                }
            } else {
                console.log(`Could not find compendium ${packName}`);
            }
        }
    }

    // all new entities
    const ents = [].concat([clazz], eq1, eq2, eq3, weapons, armors, startingItems, startingRollItems);

    // add items as owned items
    const items = ents.filter(e => e instanceof VGItem);

    // for other non-item entities, just add some description text
    const nonItems = ents.filter(e => !(e instanceof VGItem));
    for (const nonItem of nonItems) {
        if (nonItem && nonItem.data && nonItem.data.type) {
            const upperType = nonItem.data.type.toUpperCase();
            descriptionLines.push(`<p>&nbsp;</p><p>${upperType}: ${nonItem.data.name}</p>`);
        } else {
            console.log(`Skipping non-item ${nonItem}`);
        }
    }

    return {
        actorImg: clazz.img,
        agility,
        credits: creditsRoll.total,
        description: descriptionLines.join(""),
        favors: favorsRoll.total,
        hitPoints,
        items: items.map(i => i.data),
        neuromancyPoints,
        presence,
        strength,
        tokenImg: clazz.img,
        toughness,
    };
}

const scvmToActorData = (s) => {
    return {
        type: "character",
        // TODO: do we need to set folder or sort?
        // folder: folder.data._id,
        // sort: 12000,
        data: {
            abilities: {
                strength: { value: s.strength },
                agility: { value: s.agility },
                presence: { value: s.presence },
                toughness: { value: s.toughness },
            },
            credits: s.credits,
            description: s.description,
            hp: {
                max: s.hitPoints,
                value: s.hitPoints,
            },
            favors: {
                max: s.favors,
                value: s.favors,
            },
            neuromancyPoints: {
                max: s.neuromancyPoints,
                value: s.neuromancyPoints,
            },
        },
        items: s.items,
        flags: {}
    };
};

const createActorWithScvm = async (s) => {
    const data = scvmToActorData(s);
    // set some additional fields for new characters
    data.name = randomName();
    data.img = s.actorImg;
    // use VGActor.create() so we get default disposition, actor link, vision, etc
    const actor = await VGActor.create(data);
    actor.sheet.render(true);
};

const updateActorWithScvm = async (actor, s) => {
    const data = scvmToActorData(s);
    data.name = randomName();
    // Explicitly nuke all items before updating.
    // Before Foundry 0.8.x, actor.update() used to overwrite items,
    // but now doesn't. Maybe because we're passing items: [item.data]?
    // Dunno.
    await actor.deleteEmbeddedDocuments("Item", [], {deleteAll: true});
    await actor.update(data);
};

const entitiesFromResults = async (results) => {
    const ents = [];
    for (let result of results) {
        const entity = await entityFromResult(result);
        if (entity) {            
            ents.push(entity);
        }
    }
    return ents;
}

const entityFromResult = async (result) => {
    // draw result type: text (0), entity (1), or compendium (2)
    // TODO: figure out how we want to handle an entity result

    // TODO: handle scroll lookup / rolls
    // TODO: can we make a recursive random scroll thingy

    if (result.data.type === 0) {
        // hack for not having recursive roll tables set up
        // TODO: set up recursive roll tables :P
        if (result.data.text === "Roll on Random Unclean Tributes") {
            const collection = game.packs.get("vastgrimm.random-scrolls");
            const content = await collection.getDocuments();
            const table = content.find(i => i.name === "Unclean Tributes");
            const draw = await table.draw({displayChat: false});
            const items = await entitiesFromResults(draw.results);
            return items[0];
        } else if (result.data.text === "Roll on Random Sacred Tributes") {
            const collection = game.packs.get("vastgrimm.random-scrolls");
            const content = await collection.getDocuments();
            const table = content.find(i => i.name === "Sacred Tributes");
            const draw = await table.draw({displayChat: false});
            const items = await entitiesFromResults(draw.results);
            return items[0];
        }
    } else if (result.data.type === 2) {
        // grab the item from the compendium
        const collection = game.packs.get(result.data.collection);

        if (collection) {
            // TODO: should we use pack.getEntity(entryId) ?
            // const item = await collection.getEntity(result._id);
            const content = await collection.getDocuments();
            const entity = content.find(i => i.name === result.data.text);
            return entity;
        } else {
            console.log("Could not find collection for result:");
            console.log(result);
        }
    }
};

const abilityBonus = (rollTotal) => {
    if (rollTotal <= 4) {
        return -3;
    } else if (rollTotal <= 6) {
        return -2;
    } else if (rollTotal <= 8) {
        return -1;        
    } else if (rollTotal <= 12) {
        return 0;
    } else if (rollTotal <= 14) {
        return 1;
    } else if (rollTotal <= 16) {
        return 2;
    } else {
        // 17 - 20+
        return 3;
    }
};

/** Workaround for compendium RollTables not honoring replacement=false */
const compendiumTableDrawMany = async (rollTable, numDesired) => {
    let rollTotals = [];
    let results = [];
    while (rollTotals.length < numDesired) {
        const tableDraw = await rollTable.draw({displayChat: false});
        if (rollTotals.includes(tableDraw.roll.total)) {
            // already rolled this, so roll again
            continue;
        }
        rollTotals.push(tableDraw.roll.total);
        results = results.concat(tableDraw.results);
    }
    return results;
};