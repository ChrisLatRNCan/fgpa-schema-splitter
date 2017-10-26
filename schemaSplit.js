// schema to be splitted
let viewerSchema = require('./schemas/schema.json');

// External libraries
const $RefParser = require('json-schema-ref-parser');
const $DotProp = require('dot-prop');
const $PapaParse = require('papaparse');
const deepKeys = require('deep-keys');

// nodejs library
const $FS = require('fs');
const $Promise = require('promise');


const lang = ['en-CA', 'fr-CA'];
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
 *  - addLabels: add all labels.
 *  - addSchemaLabel: add schema attribute to main properties.
 *  - addTitleLabel: add title attribute to properties.
 *  - addHelpLabel: add help attribute to properties.
 *  - addDefaultLabel: add default attribute to properties.
 *  - labelNestedtArrays: labelling nested arrays
 *  - addDescriptionLabel: save existing descriptions in a csv like blob
 *                          and replace them with labels.
 *  - addEnumLabel: save existing enum aray values in a csv like blob
 *                  and replace them with labels.
 *  - saveCSV: save csv like blob in a csv (comma-separated values) file
 *  - saveSchema: save schema in local file.
 *  - saveParseConfigSchema: save $ref resolved main properties of the schema
 *                            in separated JSON files.
 *  - loadCSVinJSON: load CSV file into JSON object.
 *  - resolveLabels: Replace labels by values corresponding to chosen language.
 */

 // main

replaceCircularRef(viewerSchema);

const labellingSchemaDef = new $Promise(
  (resolve, reject) => {
      if (addLabels(viewerSchema, 'definitions')) {
          resolve(viewerSchema);
      } else {
          const reason = new Error('labelling def went wrong');
          reject(reason);
      }

  }
);

// call our promise
const LabelMyDef = function () {
  labellingSchemaDef
      .then(() => {
        const parser = new $RefParser();
        parser.dereference(viewerSchema)
          .then(vSchema => {

          // Promise
          const labellingSchemaProp = new $Promise(
            (resolve, reject) => {
                if (addLabels(vSchema, 'properties')) {
                    resolve(vSchema);
                } else {
                    const reason = new Error('labelling properties went wrong');
                    reject(reason);
                }
        
            }
          );
        
          // call our promise
          const splitMe = function () {
            labellingSchemaProp
                .then(() => {
                  saveCSV(csvString);
                  saveSchema(vSchema);
                  saveParseConfigSchema(vSchema);
                  console.log('This is the END');
                })
                .catch(error => console.log(error.message));
          };
        
          splitMe();
        
          })
          .catch(err => {
            console.error(err);
          });
      })
      .catch(error => console.log(error.message));
};

LabelMyDef();

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
function addLabels(schema, start) {
  addSchemaLabel(schema[start]);
  addTitleLabel(schema[start]);
  // addHelpLabel(schema[start]);
  // addDefaultLabel(schema[start]);
  addDescriptionLabel(schema[start]);
  addEnumLabel(schema[start]);
  return true;
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
 * Add to all properties an attribute named `help` which contains a label based
 * on the name of the property and is place in the hierarchy.
 * @function addHelpLabel
 * @private
 * @param {Object} schema
 * @param {String} parent [optional] use as a prefix to generate labels
 */
function addHelpLabel(schema, parent = '') {

  const propNames = Object.getOwnPropertyNames(schema);
  let prefix = parent;

  propNames.forEach( prop => {
    const label = `${prefix}${prop}.help`;
    $DotProp.set(schema, `${prop}.help`, label);
    csvString = `${csvString},${label},[en],0,[fr],0\n`;
    // go deeper ???
    if ($DotProp.has(schema, `${prop}.properties`)) {
      addHelpLabel( $DotProp.get(schema, `${prop}.properties`), `${prefix}${prop}.`);
    }
  });
}

/**
 * Add to all properties an attribute named `default`, if it doesn't already exist,
 * which contains a label based on the name of the property and is place in the hierarchy.
 * Save existing default attribute value.
 * @function addDefaultLabel
 * @private
 * @param {Object} schema
 * @param {String} parent [optional] use as a prefix to generate labels
 */
function addDefaultLabel(schema, parent = '') {

  const propNames = Object.getOwnPropertyNames(schema);
  let prefix = parent;
  let deflt = '';

  propNames.forEach(prop => {
    const label = `${prefix}${prop}.default`;
    if ($DotProp.has(schema, `${prop}.default`)) {
      // Is this an object
      if (Array.isArray(schema[prop]['default'])){ // ARRAY

        // Finally,won't labelled array's elements
        // const labelArr = `${prefix}${prop}`;
        // labelNestedtArrays(schema[prop]['default'],labelArr);

        deflt = JSON.stringify(schema[prop]['default']).replace(/['"]+/g, '');
        csvString = `${csvString},${label},"${deflt}",1,[fr],0\n`;
        $DotProp.set(schema, `${prop}.default`, label);
      } else if (typeof schema[prop]['default'] === 'object'){ // OBJECT
        // We keep it as an object in the csv file.
        // Keys of the object are references to existing properties
        const objPropNames = Object.getOwnPropertyNames(schema[prop]['default']);
        let newObj = {};
        objPropNames.forEach(objProp => {
          const labelItem = `${label}.${objProp}`;
          const defltItem = schema[prop]['default'][objProp];
          csvString = `${csvString},${labelItem},${defltItem},1,[fr],0\n`;
          $DotProp.set(schema, `${prop}.default.${objProp}`, labelItem);
        });

      } else { // OTHERS*/
        deflt = $DotProp.get(schema, `${prop}.default`);
        csvString = `${csvString},${label},${deflt},1,[fr],0\n`;
        $DotProp.set(schema, `${prop}.default`, label);
      }
    } else {
      csvString = `${csvString},${label},[en],0,[fr],0\n`;
      $DotProp.set(schema, `${prop}.default`, label);
    }
    // go deeper ???
    if ($DotProp.has(schema, `${prop}.properties`)) {
      addDefaultLabel( $DotProp.get(schema, `${prop}.properties`), `${prefix}${prop}.`);
    }
  });
}

/**
 * Labelling in nested arrays
 * @function labelNestedtArrays
 * @private
 * @param {Array} arr
 * @param {String} label to compose label
 */
function labelNestedtArrays(arr, label) {

    const arrayLength = arr.length;
    for (var i = 0; i < arrayLength; i++) {
      if (Array.isArray(arr[i])) {
        labelNestedtArrays(arr[i], label);
      }else {
        arr[i] = `${label}.${arr[i]}`;
      }
    }
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
      const label = `${prefix}${prop}.description`;
      description = $DotProp.get(schema, `${prop}.description`);
      csvString = `${csvString},${label},"${description}",1,[fr],0\n`;
      $DotProp.set(schema, `${prop}.description`, label);
    }

    propArr = Object.getOwnPropertyNames(schema[prop]);
    // go deeper ???
    if ($DotProp.has(schema, `${prop}.properties`)) {
      addDescriptionLabel( $DotProp.get(schema, `${prop}.properties`), `${prefix}${prop}.`);
    } else if ($DotProp.has(schema, `${prop}.items.properties`)) {
      addDescriptionLabel( $DotProp.get(schema, `${prop}.items.properties`), `${prefix}${prop}.items.`);
    } else if (propArr.length !== 0) {
      propArr.forEach(Att => {
          if ($DotProp.has(schema[prop], `${Att}.description`)) {
            const label = `${prefix}${prop}.${Att}.description`;
            description = $DotProp.get(schema[prop], `${Att}.description`);
            csvString = `${csvString},${label},"${description}",1,[fr],0\n`;
            $DotProp.set(schema, `${prop}.${Att}.description`, label);
          }
      });
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
      // console.log($DotProp.get(schema, `${prop}.enum`));
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
      // console.log($DotProp.get(schema, `${prop}.items.enum`));
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
  $FS.writeFileSync('./csv/vSchema.csv', csv);
}

/**
 * Save schema in local file
 * @function saveSchema
 * @private
 * @param {Object} schema
 */
function saveSchema(schema) {
  schemaString = JSON.stringify(schema, null, 2);
  $FS.writeFileSync('./schemas/schemaAuthor.json', schemaString);
}

/**
 * Save $ref resolved main properties of the schema
 * in separated JSON files. A JSON is created for each
 * designated languages.
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
        header = `${header}"${prop}": ${JSON.stringify($DotProp.get(schema, prop), null, 2)}\n`;
    }
  });

  for (var i = 0; i < nbrLang; i++) {
    const headerWr  = resolveLabels(header, csvJSON, i);
    $FS.writeFileSync(`./pieces/header.${lang[i]}.json`, headerWr);
  }

  //*********Save properties
  const propNames = Object.getOwnPropertyNames(schema.properties);

  propNames.forEach(prop => {

    const blob = JSON.stringify($DotProp.get(schema, `properties.${prop}`), null, 2);

    for (var i = 0; i < nbrLang; i++) {
      const blobWr = resolveLabels(blob, csvJSON, i);
      $FS.writeFileSync(`./pieces/${prop}.${lang[i]}.json`, blobWr);
    }
  });

  //*********Save circular definitions, references and dependencies
  let defRef = '';
  const definitions = ['entryGroup', 'visibilitySet', 'infoSection', 'entry', 'symbologyStack', 'legendGroupControls'];

  definitions.forEach(prop => {
    defRef = `${defRef}"${prop}": ${JSON.stringify($DotProp.get(schema, `definitions.${prop}`), null, 2)},\n`;
  });

  defRef = `${defRef}"circular": ${JSON.stringify($DotProp.get(schema, `definitions.circular`), null, 2)}\n`;

  for (var i = 0; i < nbrLang; i++) {
    const defRefWr = resolveLabels(defRef, csvJSON, i);
    $FS.writeFileSync(`./pieces/circular.${lang[i]}.json`, defRefWr);
  }
}

/**
 * Load CSV file into JSON object
 * @function loadCSVinJSON
 * @private
 */
function loadCSVinJSON() {

  // Read file as a string
  // const csvFilename = `./csv/vSchema.csv`;
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

/**
 * Replace labels by values corresponding to chosen language.
 * @function resolveLabels
 * @private
 * @param {String} schemaString schema as a string
 * @param {String} csvJSON cvs content as a JSON
 * @param {String} langIdx language index
 */
function resolveLabels(schemaString, csvJSON, langIdx) {

  let newString = schemaString;
  const idx = 2+2*langIdx;

  csvJSON.data.forEach(record => {
    if(record[1] !== undefined) {
      const label = record[1];
      const value = record[idx];
      const regex = new RegExp('[^\.a-z]' + label + '[^\.a-z]', 'g');

      // put string between double quotes
      if (value === 'true' || value === 'false') {
        newString = newString.replace(regex, value);
      } else {
        newString = newString.replace(regex, '"' + value + '"');
      }
    }
  });
  return newString;
}

/**
 * Update CSV file.
 * @function updateCSV
 * @private
 */
function updateCSV() {

}