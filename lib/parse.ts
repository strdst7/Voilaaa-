/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */

export const parseJSON = (str: string) => {
  try {
    const start = str.indexOf('{');
    const end = str.lastIndexOf('}') + 1;
    if (start === -1 || end === 0) {
      throw new Error('No JSON object found in response');
    }
    return JSON.parse(str.substring(start, end));
  } catch (e) {
    console.error('Failed to parse JSON:', e, str);
    return {};
  }
};

export const parseHTML = (str: string, opener: string, closer: string) => {
  try {
    const start = str.indexOf('<!DOCTYPE html>');
    const htmlStart = start !== -1 ? start : str.indexOf('<html');
    
    if (htmlStart === -1) {
      // Fallback: try to find anything between code openers
      const codeStart = str.indexOf(opener);
      const codeEnd = str.lastIndexOf(closer);
      if (codeStart !== -1 && codeEnd !== -1) {
        return str.substring(codeStart + opener.length, codeEnd).trim();
      }
      return '';
    }
    
    const end = str.lastIndexOf(closer);
    if (end !== -1 && end > htmlStart) {
      return str.substring(htmlStart, end).trim();
    }
    
    return str.substring(htmlStart).trim();
  } catch (e) {
    console.error('Failed to parse HTML:', e, str);
    return '';
  }
};
