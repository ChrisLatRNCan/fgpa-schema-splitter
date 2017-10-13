// schema to be splitted
let viewerSchema = require('./schemas/schema.json');

// External libraries
const $RefParser = require('json-schema-ref-parser');
const $DotProp = require('dot-prop');
const $PapaParse = require('papaparse');
// const $TreeKit = require('tree-kit');
// const $Lodash = require('lodash');

// nodejs library
const $FS = require('fs');
let csvString = '';


/**
 *
 * @name schemaSplit
 * @requires dependencies
 * @description
 *
 * The `schemaSplit` service preprocesses the fgpv schema to make it digestible
 * by the fgpa authoring tool.
 * Provides six functions:
 *  - replaceCircularRef: manage circular references ($ref).
 *  - addTitleLabel: add title attribute to properties.
 *  - addDescriptionLabel: save existing descriptions in a csv like blob
 *                          and replace them with labels.
 *  - addEnumLabel: save existing enum aray values in a csv like blob
 *                  and replace them with labels.
 *  - saveCSV: save csv like blob in a csv (comma-separated values) file
 *  - saveParseConfigSchema: save $ref resolved main properties of the schema
 *                            in separated JSON files.
 */

 // main

replaceCircularRef(viewerSchema);

const labelling = function(schema) {
  var promise = new Promise(resolve => {
    addLabels(schema)
    resolve(schema);
  });
};

const parser = new $RefParser();
  parser.dereference(viewerSchema)
    .then(vSchema => {
      labelling(vSchema).then( vSchema => {
        saveCSV(csvString);
      });
      // saveParseConfigSchema(vSchema);
    })
    .catch(err => {
      console.error(err);
    });


// functions declarations

/**
 * Replace circular references ($ref) in schema with a new
 * non-obstructive definition.
 *
 * @function replaceCircularRef
 * @private
 * @param {Object} schema
 */
function replaceCircularRef(schema) {
  const target1 = `definitions.entryGroup.properties.children.items.oneOf`;
  const target2 = `definitions.visibilitySet.properties.exclusiveVisibility.items.oneOf`;
  let enumArray1 = $DotProp.get(schema, target1);
  let enumArray2 = $DotProp.get(schema, target2);
  const circularDef = enumArray1.shift();

  // Create new definition object to be used as a non circular reference
  $DotProp.set(schema, `definitions.circular`, {"type": "object", "properties": {"circRef": "entryGroup"}});

  // Replace circular reference with non-circular one
  enumArray1.unshift({ "$ref": "#/definitions/circular" });
  $DotProp.set(schema, target1, enumArray1);

  // Replace circular reference with non-circular one
  enumArray2.shift();
  enumArray2.unshift({ "$ref": "#/definitions/circular" });
  $DotProp.set(schema, target2, enumArray2);
}

/**
 * Add labels
 * @function addLabels
 * @private
 * @param {Object} schema
 */
function addLabels(schema) {
  addSchemaLabel(schema.properties);
  addTitleLabel(schema.properties);
  addDescriptionLabel(schema.properties);
  addEnumLabel(schema.properties);
}

/**
 * Add to all first level properties an attribute named `schema` which contains a label based
 * on the name of the property.
 * @function addSchemaLabel
 * @private
 * @param {Object} schema
 */
function addSchemaLabel(schema) {
      const propNames = Object.getOwnPropertyNames(schema);
      propNames.forEach(prop => {
          $DotProp.set(schema, `${prop}.schema`, prop);
      });
}

/**
 * Add to all properties an attribute named `title` which contains a label based
 * on the name of the property and is place in the hierarchy.
 * @function addTitleLabel
 * @private
 * @param {Object} schema
 * @param {String} parent [optional] use as a prefix to generate labels
 */
function addTitleLabel(schema, parent = '') {

    const propNames = Object.getOwnPropertyNames(schema);
    let prefix = parent;

    propNames.forEach( prop => {
      const label = `${prefix}${prop}.title`;
      $DotProp.set(schema, `${prop}.title`, label);
      csvString = `${csvString},${label},[en],0,[fr],0\n`;
      // go deeper ???
      if ($DotProp.has(schema, `${prop}.properties`)) {
        addTitleLabel( $DotProp.get(schema, `${prop}.properties`), `${prefix}${prop}.`);
      }
    });
}

/**
 * Save existing `descriptions` property values in a csv like blob
 * and replace those values with labels.
 * @function addDescriptionLabel
 * @private
 * @param {Object} schema
 * @param {String} parent [optional] use as a prefix to generate labels
 */
function addDescriptionLabel(schema, parent = '') {
  const propNames = Object.getOwnPropertyNames(schema);
  let prefix = parent;
  let description = '';

  propNames.forEach(prop => {
    if ($DotProp.has(schema, `${prop}.description`)) {
      const label = `${prefix}${prop}.desc`;
      description = $DotProp.get(schema, `${prop}.description`);
      csvString = `${csvString},${label},"${description}",1,[fr],0\n`;
      $DotProp.set(schema, `${prop}.description`, label);
    }
    // go deeper ???
    if ($DotProp.has(schema, `${prop}.properties`)) {
      addDescriptionLabel( $DotProp.get(schema, `${prop}.properties`), `${prefix}${prop}.`);
    }
  });
}

/**
 * Save existing `enum` array values in a csv like blob
 * and replace those values with labels.
 * @function addEnumLabel
 * @private
 * @param {Object} schema
 * @param {String} parent [optional] use as a prefix to generate labels
 */
function addEnumLabel(schema, parent = '') {
  const propNames = Object.getOwnPropertyNames(schema);
  let prefix = parent;

  propNames.forEach(prop => {
    if ($DotProp.has(schema, `${prop}.enum`)) {
      let enumArray = $DotProp.get(schema, `${prop}.enum`);
      let newEnum = [];
      enumArray.forEach( element => {
        const label = `${prefix}${prop}.enum.${element}`;
        csvString = `${csvString},${label},${element},1,[fr],0\n`;
        newEnum.push(label);
      });
      $DotProp.set(schema, `${prop}.enum`, newEnum);
      console.log($DotProp.get(schema, `${prop}.enum`));
    }

    let newEnumItems = [];
    if ($DotProp.has(schema, `${prop}.items.enum`)) {
      let enumArray = $DotProp.get(schema, `${prop}.items.enum`);
      enumArray.forEach(element => {
        const label = `${prefix}${prop}.items.enum.${element}`;
        csvString = `${csvString},${label},${element},1,[fr],0\n`;
        newEnumItems.push(label);
      });
      $DotProp.set(schema, `${prop}.items.enum`, newEnumItems);
      console.log($DotProp.get(schema, `${prop}.items.enum`));
    }

    // go deeper ???
    if ($DotProp.has(schema, `${prop}.properties`)) {
      addEnumLabel( $DotProp.get(schema, `${prop}.properties`), `${prefix}${prop}.`);
    }

  });
}

/**
 * Save csv info in a local file
 * @function saveCSV
 * @private
 * @param {Object} csv contains commas-separeted blob
 */
function saveCSV(csv) {
  $FS.writeFile(`./csv/vSchema.csv`, csv, err => {
    if(err) {
        return console.log(err);
    }
    console.log(`./csv/vSchema.csv was saved!`);
  });
}

/**
 * Save $ref resolved main properties of the schema
 * in separated JSON files.
 * @function saveParseConfigSchema
 * @private
 * @param {Object} schema
 */
function saveParseConfigSchema(schema) {

  const csvJSON = loadCSVinJSON();
  const nbrLang = (csvJSON.data[0].length - 2)/2;

  //*********Save header
  const genNames = Object.getOwnPropertyNames(schema);
  let header = '';

  genNames.forEach(prop => {
    if (prop !== `properties` && prop !== `definitions`) {
        header = `${header}"${prop}": ${JSON.stringify($DotProp.get(schema, prop))}\n`;
    }
  });

  for (var i = 0; i < nbrLang; i++) {
    const headerWr =  resolveLabels(header, csvJSON, i);
    $FS.writeFile(`./pieces/header.${i}.json`, headerWr, err => {
      if(err) {
          return console.log(err);
      }
    });
    console.log(`header.${i}.json` + " was saved!");
  }

  //*********Save properties
  const propNames = Object.getOwnPropertyNames(schema.properties);

  propNames.forEach(prop => {

    const blob = JSON.stringify($DotProp.get(schema, `properties.${prop}`));

    for (var i = 0; i < nbrLang; i++) {
      const blobWr = resolveLabels(blob, csvJSON, i);
      $FS.writeFile(`./pieces/${prop}.${i}.json`, blobWr, err => {
        if(err) {
            return console.log(err);
        }
      });
      console.log(`${prop}.${i}.json was saved!`);
    }
  });

  //*********Save circular definitions, references and dependencies
  let defRef = '';
  const definitions = ['entryGroup', 'visibilitySet', 'infoSection', 'entry', 'symbologyStack', 'legendGroupControls'];

  definitions.forEach(prop => {
    defRef = `${defRef}"${prop}": ${JSON.stringify($DotProp.get(schema, `definitions.${prop}`))},\n`;
  });

  defRef = `${defRef}"circular": ${JSON.stringify($DotProp.get(schema, `definitions.circular`))}\n`;

  for (var i = 0; i < nbrLang; i++) {
    const defRefWr = resolveLabels(defRef, csvJSON, i);
    $FS.writeFile(`./pieces/circular.${i}.json`, defRefWr, err => {
      if(err) {
          return console.log(err);
      }
    });
    console.log(`circular.${i}.json was saved`);
  }
}

/**UNDER DEV
 * Load CSV file into JSON object
 * @function loadCSVinJSON
 * @private
 */
function loadCSVinJSON() {

  // Read file as a string
  const csvFilename = `./csv/vSchema.csv`;
  const csvString = $FS.readFileSync(csvFilename, 'utf8');

  // config for papaParse
  const configPasrse = {
    delimiter: ","
  };

  // Parse string to JSON object
  const csvJSON = $PapaParse.parse(csvString, configPasrse);
  return csvJSON;
}

/**UNDER DEV
 * Replace labels by values corresponding to chosen language
 * @function resolveLabels
 * @private
 * @param {Object}
 * @param {String} csvFilename
 */
function resolveLabels(schemaString, csvJSON, langIdx) {

  let newString = schemaString;
  const idx = 2+2*langIdx;

  csvJSON.data.forEach(record => {
    const label = record[1];
    const value = record[idx];
    const regex = new RegExp(label);;
    newString = newString.replace(regex, value);
  });
  return newString;
}
