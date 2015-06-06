/**
 * @license
 * Visual Blocks Editor
 *
 * Copyright 2013 Google Inc.
 * https://developers.google.com/blockly/
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Flexible templating system for defining blocks.
 * @author spertus@google.com (Ellen Spertus)
 */
'use strict';
goog.require('goog.asserts');

/**
 * Name space for the Blocks singleton.
 * Blocks gets populated in the blocks files, possibly through calls to
 * Blocks.addTemplate().
 */
goog.provide('Blockly.Blocks');

/**
 * Unique ID counter for created blocks.
 * @private
 */
Blockly.Blocks.uidCounter_ = 0;

/**
 * Generate a unique ID.  This will be locally or globally unique, depending on
 * whether we are in single user or realtime collaborative mode.
 * @return {string}
 */
Blockly.Blocks.genUid = function() {
  var uid = (++Blockly.Blocks.uidCounter_).toString();
  if (Blockly.Realtime.isEnabled()) {
    return Blockly.Realtime.genUid(uid);
  } else {
    return uid;
  }
};

/**
 * Create a block template and add it as a field to Blockly.Blocks with the
 * name details.blockName.
 * @param {!Object} details Details about the block that should be created.
 *     The following fields are used:
 *     - blockName {string} The name of the block, which should be unique.
 *     - colour {number} The hue value of the colour to use for the block.
 *       (Blockly.HSV_SATURATION and Blockly.HSV_VALUE are used for saturation
 *       and value, respectively.)
 *     - output {?string|Array.<string>} Output type.  If undefined, there are
 *       assumed to be no outputs.  Otherwise, this is interpreted the same way
 *       as arguments to Blockly.Block.setCheck():
 *       - null: Any type can be produced.
 *       - String: Only the specified type (e.g., 'Number') can be produced.
 *       - Array.<string>: Any of the specified types can be produced.
 *     - message {string} A message suitable for passing as a first argument to
 *       Blockly.Block.interpolateMsg().  Specifically, it should consist of
 *       text to be displayed on the block, optionally interspersed with
 *       references to inputs (one-based indices into the args array) or fields,
 *       such as '%1' for the first element of args.  The creation of dummy
 *       inputs can be forced with a newline (\n).
 *     - args {Array.<Object>} One or more descriptions of value inputs.
 *       TODO: Add Fields and statement stacks.
 *       Each object in the array can have the following fields:
 *       - name {string} The name of the input.
 *       - type {?number} One of Blockly.INPUT_VALUE, Blockly.NEXT_STATEMENT, or
 *         ??.   If not provided, it is assumed to be Blockly.INPUT_VALUE.
 *       - check {?string|Array.<string>} Input type.  See description of the
 *         output field above.
 *       - align {?number} One of Blockly.ALIGN_LEFT, Blockly.ALIGN_CENTRE, or
 *         Blockly.ALIGN_RIGHT (the default value, if not explicitly provided).
 *     - inline {?boolean}: Whether inputs should be inline (true) or external
 *       (false).  If not explicitly specified, inputs will be inline if message
 *       references, and ends with, a single value input.
 *     - previousStatement {?boolean} Whether there should be a statement
 *       connector on the top of the block.  If not specified, the default
 *       value will be !output.
 *     - nextStatement {?boolean} Whether there should be a statement
 *       connector on the bottom of the block.  If not specified, the default
 *       value will be !output.
 *     - tooltip {?string|Function} Tooltip text or a function on this block
 *       that returns a tooltip string.
 *     - helpUrl {?string|Function} The help URL, or a function on this block
 *       that returns the help URL.
 *     - switchable {?boolean} Whether the block should be switchable between
 *       an expression and statement.  Specifically, if true, the block will
 *       begin as an expression (having an output).  There will be a context
 *       menu option 'Remove output'.  If selected, the output will disappear,
 *       and previous and next statement connectors will appear.  The context
 *       menu option 'Remove output' will be replaced by 'Add Output'.  If
 *       selected, the output will reappear and the statement connectors will
 *       disappear.
 *     Additional fields will be ignored.
 */
Blockly.Blocks.addTemplate = function(json) {
  // Validate inputs.
  goog.asserts.assertString(json['name'], 'Unnamed block.');
  goog.asserts.assert(Blockly.Blocks[json['name']] === undefined,
      'Blockly.Blocks already has a field named %s.', json['name']);
  goog.asserts.assertString(json['message'], 'No message.');
  goog.asserts.assertArray(json['args'], 'No args.');
  goog.asserts.assert(json['output'] == undefined ||
      json['previousStatement'] == undefined,
      'Must not have both an output and a previousStatement.');

  var block = {};
  /**
   * Build up template.
   * @this Blockly.Block
   */
  block.init = function() {
    // Set basic properties of block.
    this.setColour(json['colour']);

    // Parse the message and interpolate the arguments.
    // Build a list of elements.
    var tokens = json['message'].split(/(%\d+)/);
    var indexDup = [];
    var indexCount = 0;
    var elements = [];
    for (var i = 0; i < tokens.length; i++) {
      var token = tokens[i];
      if (token.match(/^%\d+$/)) {
        var index = parseInt(token.substring(1), 10);
        goog.asserts.assert(index > 0 && index <= json['args'].length,
            'Message index "%s" out of range.', token);
        goog.asserts.assert(!indexDup[index],
            'Message index "%s" duplicated.', token);
        indexDup[index] = true;
        indexCount++;
        elements.push(json['args'][index - 1]);
      } else {
        token = token.replace(/%%/g, '%').trim();
        if (token) {
          elements.push(token);
        }
      }
    }
    goog.asserts.assert(indexCount == json['args'].length,
        'Message does not reference all %s arg(s).', json['args'].length);
    // Add last dummy input if needed.
    if (elements.length && typeof elements[elements.length - 1] == 'string') {
      var input = {type: 'input_dummy'};
      if (json['lastDummyAlign']) {
        input['align'] = json['lastDummyAlign'];
      }
      elements.push(input);
    }
    // Populate block with inputs and fields.
    var fieldStack = [];
    for (var i = 0; i < elements.length; i++) {
      var element = elements[i];
      if (typeof element == 'string') {
        fieldStack.push([element, undefined]);
      } else {
        var field = null;
        var input = null;
        switch (element['type']) {
          case 'field_input':
            field = new Blockly.FieldTextInput(element['text']);
            break;
          case 'field_angle':
            field = new Blockly.FieldTextInput(element['angle']);
            break;
          case 'field_checkbox':
            field = new Blockly.FieldTextInput(element['checked']);
            break;
          case 'field_colour':
            field = new Blockly.FieldTextInput(element['colour']);
            break;
          case 'field_date':
            field = new Blockly.FieldTextInput(element['date']);
            break;
          case 'field_variable':
            field = new Blockly.FieldTextInput(element['variable']);
            break;
          case 'field_dropdown':
            field = new Blockly.FieldTextInput(element['options']);
            break;
          case 'field_image':
            field = new Blockly.FieldTextInput(element['src'],
                element['width'], element['height'], element['alt']);
            break;
          case 'input_value':
            input = this.appendValueInput(element['name']);
            break;
          case 'input_statement':
            input = this.appendStatementInput(element['name']);
            break;
          case 'input_dummy':
            input = this.appendDummyInput(element['name']);
            break;
          default:
            throw 'Unknown element type: ' + element['type'];
        }
        if (field) {
          fieldStack.push([field, element['name']]);
        } else if (input) {
          if (element['check']) {
            input.setCheck(element['check']);
          }
          if (element['align']) {
            input.setAlign(element['align']);
          }
          for (var j = 0; j < fieldStack.length; j++) {
            input.appendField(fieldStack[j][0], fieldStack[j][1]);
          }
          fieldStack.length = 0;
        }
      }
    }

    if (json['inputsInline']) {
      this.setInputsInline(true);
    }
    // Set output and previous/next connections.
    if (json['output'] !== undefined) {
      this.setOutput(true, json['output']);
    }
    if (json['previousStatement'] !== undefined) {
      this.setPreviousStatement(true, json['previousStatement']);
    }
    if (json['nextStatement'] !== undefined) {
      this.setNextStatement(true, json['nextStatement']);
    }
    this.setTooltip(json['tooltip']);
    this.setHelpUrl(json['helpUrl']);
  };

  // Add new block to Blockly.Blocks.
  Blockly.Blocks[json['name']] = block;
};
