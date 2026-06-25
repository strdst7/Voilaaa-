/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */

export const SPEC_FROM_VIDEO_PROMPT = `You are a pedagogist and product designer with deep expertise in crafting engaging learning experiences via interactive web apps.

Examine the contents of the attached video. Then, provide the following in a JSON format:
1. "spec": A detailed and carefully considered spec for an interactive web app designed to complement the video and reinforce its key idea or ideas. The recipient of the spec does not have access to the video, so the spec must be thorough and self-contained (the spec must not mention that it is based on a video). 
2. "flashcards": A list of at least 5 key terms and their concise definitions extracted from the video content, useful for active recall. Each flashcard should be an object with "term" and "definition" fields.

Here is an example structure:
{
  "spec": "In music, chords create expectations... [detailed spec text]",
  "flashcards": [
    {"term": "Tonic", "definition": "The first scale degree of a diatonic scale and the tonal center."},
    {"term": "Dominant", "definition": "The fifth scale degree, which has a strong pull to resolve to the tonic."}
  ]
}

The goal of the app that is to be built based on the spec is to enhance understanding through simple and playful design. The provided spec should not be overly complex, i.e., a junior web developer should be able to implement it in a single html file (with all styles and scripts inline). Most importantly, the spec must clearly outline the core mechanics of the app, and those mechanics must be highly effective in reinforcing the given video's key idea(s).`;

export const CODE_REGION_OPENER = '```';
export const CODE_REGION_CLOSER = '```';

export const SPEC_ADDENDUM = `\n\nThe app must be fully responsive and function properly on both desktop and mobile. Provide the code as a single, self-contained HTML document. All styles and scripts must be inline. In the result, encase the code between "${CODE_REGION_OPENER}" and "${CODE_REGION_CLOSER}" for easy parsing.`;
