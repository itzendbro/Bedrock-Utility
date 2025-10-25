


import { GoogleGenAI, Type, Chat, Modality } from "@google/genai";
import { filesToGenerativeParts } from "../utils/fileConverter";
import { GeneratedFile, UploadedFile, AssetMapping } from "../types";
import { generateCacheKey, getFromCache, setInCache } from '../utils/caching';
import JSZip from 'jszip';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const addonPlanSchema = {
    type: Type.OBJECT,
    properties: {
        plan: {
            type: Type.OBJECT,
            description: "A structured plan outlining all components of the addon.",
            properties: {
                summary: { type: Type.STRING, description: "A one-sentence summary of the addon's core concept." },
                entities: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING, description: "List of custom entities to create (e.g., 'Phoenix mob')." }
                },
                items: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING, description: "List of custom items to create (e.g., 'Wizard Staff')." }
                },
                blocks: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING, description: "List of custom blocks to create (e.g., 'Magic Crystal Block')." }
                },
                scripts: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING, description: "List of scripting features to implement (e.g., 'Staff shoots fireball on use')." }
                },
                recipes: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING, description: "List of crafting recipes to add (e.g., 'Craft wizard staff with blaze rod and diamond')." }
                },
                assets: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING, description: "List of required art/sound assets to be created or mapped (e.g., 'Phoenix texture', 'Fireball sound')." }
                }
            }
        }
    },
    required: ["plan"]
};

const fileGenerationSchema = {
  type: Type.OBJECT,
  properties: {
    files: {
      type: Type.ARRAY,
      description: "An array of files to be generated for the Minecraft addon.",
      items: {
        type: Type.OBJECT,
        properties: {
          path: {
            type: Type.STRING,
            description: "The full path of the file, including folders. e.g. 'behavior_pack/entities/custom.json'",
          },
          content: {
            type: Type.STRING,
            description: "The full content of the file.",
          },
        },
        required: ["path", "content"],
      },
    },
    assetMappings: {
        type: Type.ARRAY,
        description: "An array of mappings for existing assets to new paths.",
        items: {
            type: Type.OBJECT,
            properties: {
                originalPath: {
                    type: Type.STRING,
                    description: "The original path/filename of the asset provided by the user.",
                },
                newPath: {
                    type: Type.STRING,
                    description: "The new path where this asset should be placed in the final addon.",
                },
            },
            required: ["originalPath", "newPath"],
        }
    },
    summaryReport: {
        type: Type.STRING,
        description: "A detailed summary report in Markdown format. It must outline all merge actions, list every conflict detected (e.g., duplicate identifiers, script collisions, asset overlaps), and explain precisely how each was resolved (e.g., 'Renamed identifier custom:sword to custom:sword_merged and updated 3 files').",
    }
  },
  required: ["files"],
};

const unifiedGenerationSchema = {
    type: Type.OBJECT,
    properties: {
      plan: {
        ...addonPlanSchema.properties.plan,
        description: "A detailed architectural plan for a complex addon. If the user's request is simple or script-focused, do not generate this field; generate the 'files' field instead."
      },
      files: {
        ...fileGenerationSchema.properties.files,
        description: "The complete set of generated files for the addon. If the user's request is complex, generate the 'plan' field instead."
      },
      assetMappings: fileGenerationSchema.properties.assetMappings,
      summaryReport: fileGenerationSchema.properties.summaryReport,
    },
  };

const particleSettingsSchema = {
    type: Type.OBJECT,
    properties: {
        identifier: { type: Type.STRING, description: "Identifier for the particle, e.g., 'custom:fire_burst'." },
        texture: { type: Type.STRING, description: "Texture path, e.g., 'textures/particle/flame_atlas'." },
        lifespan: { type: Type.NUMBER, description: "Average lifespan of a particle in seconds." },
        rate: { type: Type.NUMBER, description: "Number of particles to emit per second." },
        maxParticles: { type: Type.NUMBER, description: "Maximum number of particles that can exist at once." },
        emitterShape: { type: Type.STRING, description: "Shape of the emitter ('point', 'sphere', 'box')." },
        emitterRadius: { type: Type.NUMBER, description: "Radius of the emitter shape (for sphere)." },
        direction: { type: Type.STRING, description: "Initial direction of particles ('outward', 'upward')." },
        initialSpeed: { type: Type.NUMBER, description: "Initial speed of particles." },
        gravity: { type: Type.NUMBER, description: "Gravity effect on particles (can be negative)." },
        airDrag: { type: Type.NUMBER, description: "Air drag coefficient." },
        startSize: { type: Type.NUMBER, description: "Starting size of the particle." },
        endSize: { type: Type.NUMBER, description: "Ending size of the particle." },
        startColor: { type: Type.STRING, description: "Starting color in hex format (e.g., '#FF0000')." },
        endColor: { type: Type.STRING, description: "Ending color in hex format (e.g., '#FFFF00')." },
        startOpacity: { type: Type.NUMBER, description: "Starting opacity (0-1)." },
        endOpacity: { type: Type.NUMBER, description: "Ending opacity (0-1)." },
    }
};

const experimentalTogglesSchema = {
    type: Type.OBJECT,
    properties: {
        toggles: {
            type: Type.ARRAY,
            description: "A list of the names of the experimental toggles required for the addon to function correctly. Example: ['Holiday Creator Features', 'Beta APIs'].",
            items: {
                type: Type.STRING,
            }
        },
        reasoning: {
            type: Type.STRING,
            description: "A brief, user-friendly explanation of why these toggles are needed, written in Markdown."
        }
    },
    required: ["toggles", "reasoning"]
};

const parseJsonResponse = (responseText: string) => {
    try {
        const jsonText = responseText.trim();
        // Sometimes the response includes markdown backticks for JSON
        const cleanJsonText = jsonText.replace(/^```json/, '').replace(/```$/, '').trim();
        const result = JSON.parse(cleanJsonText);
        return result;
    } catch (e) {
        console.error("Failed to parse Gemini response as JSON", e);
        console.error("Raw response:", responseText);
        throw new Error("The AI returned a response that couldn't be understood. This can happen with very complex or ambiguous requests. Please try simplifying your prompt, or try again.");
    }
}

/**
 * Unzips any compressed files (.zip, .mcaddon, .mcpack) into a flat list of files.
 */
const processAndUnzipFiles = async (uploadedFiles: UploadedFile[]): Promise<UploadedFile[]> => {
    const processedFiles: UploadedFile[] = [];
    
    for (const uploadedFile of uploadedFiles) {
        const fileName = uploadedFile.file.name.toLowerCase();
        if (fileName.endsWith('.zip') || fileName.endsWith('.mcaddon') || fileName.endsWith('.mcpack')) {
            try {
                const zip = await JSZip.loadAsync(uploadedFile.file);
                for (const path in zip.files) {
                    if (!zip.files[path].dir) {
                        const fileObject = zip.files[path];
                        const blob = await fileObject.async('blob');
                        // Use the internal path as the file name for identification
                        const newFile = new File([blob], fileObject.name, { type: blob.type });
                        processedFiles.push({ file: newFile, type: 'addon_file' });
                    }
                }
            } catch (e) {
                console.error(`Failed to unzip ${uploadedFile.file.name}, adding the file itself.`, e);
                processedFiles.push(uploadedFile); // If unzipping fails, just add the original zip
            }
        } else {
            processedFiles.push(uploadedFile);
        }
    }
    return processedFiles;
}

/**
 * Intelligently converts files to parts for the Gemini API.
 * Text files are sent with their full content.
 * Binary files are sent as a list of paths to reduce payload size.
 */
const filesToSmartParts = async (files: UploadedFile[]) => {
    const TEXT_EXTENSIONS = ['.json', '.js', '.mcfunction', '.lang', '.md', '.txt'];
    const parts = [];
    const binaryFilePaths = [];
  
    for (const uploadedFile of files) {
      const fileName = uploadedFile.file.name;
      const isText = TEXT_EXTENSIONS.some(ext => fileName.toLowerCase().endsWith(ext));
  
      if (isText) {
        try {
          const content = await uploadedFile.file.text();
          parts.push({ text: `File path: ${fileName}\n\n---\n\n${content}` });
        } catch (e) {
          console.warn(`Could not read file ${fileName} as text, treating as binary.`, e);
          binaryFilePaths.push(fileName);
        }
      } else {
        binaryFilePaths.push(fileName);
      }
    }
  
    if (binaryFilePaths.length > 0) {
      parts.push({ text: `The following binary asset files also exist. You must create assetMappings for them to include them in the final addon:\n- ${binaryFilePaths.join('\n- ')}` });
    }
    return parts;
};

const performSingleGeneration = async (systemInstruction: string, prompt: string, parts: any[], temperature: number) => {
    const contents = { parts: [{ text: prompt }, ...parts] };
  
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: contents,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: fileGenerationSchema,
        temperature: temperature,
      },
    });
  
    const result = parseJsonResponse(response.text);
    return result as { files: GeneratedFile[], assetMappings?: AssetMapping[], summaryReport?: string };
}

const generateAddonFiles = async (systemInstruction: string, prompt: string, uploadedFiles: UploadedFile[], useSmartParts: boolean = false) => {
  const parts = useSmartParts ? await filesToSmartParts(uploadedFiles) : await filesToGenerativeParts(uploadedFiles);

  // --- Caching Logic Start ---
  // Note: Caching with smart parts might be less effective if file content is the primary differentiator.
  const partIdentifier = parts.map(p => p.text || p.inlineData.mimeType).join('|');
  const cacheKey = await generateCacheKey([systemInstruction, prompt, partIdentifier]);
  const cachedData = getFromCache<{ files: GeneratedFile[], assetMappings?: AssetMapping[], summaryReport?: string }>(cacheKey);

  if (cachedData) {
      console.log("Cache hit! Returning cached addon files.", cacheKey);
      return cachedData;
  }
  console.log("Cache miss. Generating new addon files.", cacheKey);
  // --- Caching Logic End ---

  // Step 1: Initial Generation
  const initialResult = await performSingleGeneration(systemInstruction, prompt, parts, 0.1);

  if (!initialResult.files || initialResult.files.length === 0) {
    throw new Error("The AI did not generate any files in the initial step. Your request might be too vague, unsupported, or against the safety policy. Please provide more specific details and try again.");
  }
  
  // Step 2: Verification and Correction
  console.log("Performing verification and correction step...");
  // FIX: Replaced backticks with single/double quotes in the template literal to avoid TS parsing errors.
  const verificationSystemInstruction = `You are the infallible core of a "self-correcting IDE" for Minecraft Bedrock addons. Your function is to act as the final Quality Assurance and validation engine. You will receive a set of addon files generated by a creative AI. Your task is to meticulously analyze these files against the official Minecraft Bedrock schema, fix ALL errors (syntax, logical, or structural), and ensure perfect, flawless cohesion. You are the final gatekeeper; the files you output MUST be 100% bug-free, production-ready, and logically perfect.

Your verification pipeline is as follows:

1.  **Strict JSON Schema & Syntax Validation**:
    -   For every JSON file (manifest.json, entities, items, blocks, loot_tables, etc.), validate its structure against the latest official Minecraft Bedrock schemas.
    -   Correct any structural errors, missing required fields, incorrect data types (e.g., string instead of number), or misplaced commas.
    -   Ensure all identifiers are valid and correctly formatted (e.g., "minecraft:stone", "custom:silver_sword").
    -   Ensure all 'format_version' properties are the latest stable versions (e.g., '1.21.10' for items, '1.21.10' for blocks) and are consistent with the 'min_engine_version' in the manifest.

2.  **Absolute Path Management & Dependency Validation**:
    -   Create a complete dependency map of all files.
    -   Cross-reference EVERY path mentioned within EVERY file. This includes texture paths in RP entity/item/block files, script entry points in 'manifest.json', function calls, animation controller names, render controller names, and sound event aliases.
    -   If a path points to a file that doesn't exist in the provided file list, you must either create a placeholder file or, preferably, correct the path to a file that does exist. There must be ZERO broken paths.
    -   Ensure that for every provided binary asset, there is a corresponding 'assetMapping' and a reference to it within a JSON file. Correct or create these references if missing.

3.  **Scripting API & Logic Analysis (for .js files)**:
    -   Validate JavaScript syntax to be 100% error-free. No exceptions.
    -   Verify all calls to the Minecraft Script API (e.g., '@minecraft/server') are using correct, non-deprecated methods for the module version specified in the manifest. Prefer stable versions such as '"@minecraft/server": "1.12.0-beta"'.
    -   Analyze the script logic for common errors: undefined variables, race conditions, incorrect event usage, infinite loops, and performance anti-patterns.

4.  **Logical Cohesion & Consistency**:
    -   **Verify Manifest Integrity & Pack Linking (Strict & Final)**:
        -   **Naming:** The BP's 'header.name' must end with " Behavior", and the RP's with " Resource". Correct if necessary.
        -   **UUIDs:** The BP header UUID, RP header UUID, BP module UUID, and RP module UUID must ALL be unique. Validate this and regenerate any duplicates.
        -   **Metadata:** Both manifests MUST contain the correct 'metadata' section with authors: ["Bedrock Utility", "Shadid234"] and url: "www.bedrock-utility.com". Add or fix it if missing.
        -   **Dependencies:** The behavior pack's manifest MUST have a 'dependencies' array that correctly points to the resource pack's module UUID and version. The resource pack MUST NOT have a dependency on the behavior pack. If the dependency is missing or incorrect in the BP, you MUST add or fix it.
    -   Ensure that all custom identifiers (e.g., 'custom:magic_sword') are used consistently across all files (item/block definition, recipes, loot tables, language files). A typo in one file means it must be fixed everywhere.
    -   If a '.lang' file exists, ensure every custom item/entity/block has a corresponding 'tile.custom:thing.name=My Thing' entry.
    -   **Verify Item/Block Component Richness**: Ensure that elements have a rich and logical set of components based on their description. For example, a sword should have 'minecraft:damage', food should have 'minecraft:food', and a glowing block must have 'minecraft:light_emission'.
    -   **Verify Item Texture Integrity (Strict & Final)**: This is the most critical validation step for items.
        -   For every item file in 'behavior_pack/items/', you MUST verify it contains the icon component with the exact structure: '"minecraft:icon":{"texture":"<item_identifier>"}'. The '<item_identifier>' used here MUST be the item's own identifier.
        -   You MUST validate the 'resource_pack/textures/item_texture.json' file. It MUST be a single JSON object with three keys: '"resource_pack_name"', '"texture_name"', and '"texture_data"'. The value for '"texture_name"' MUST be exactly '"atlas.items"'. The 'texture_data' object must be flawlessly structured. The key for each entry MUST be the item's identifier, and the value for the 'textures' property MUST be a string following the format 'textures/items/<texture_name>'.
    -   **Verify Block Integrity (Strict & Final)**:
        -   **Structure Check:** Every block JSON file MUST start with a 'minecraft:block' object immediately after 'format_version'. The 'description' and 'components' MUST be inside this object.
        -   **Component Check:**
            - Verify 'minecraft:destructible_by_mining' is used for block hardness, not any other property.
            - Verify 'minecraft:display_name' points to a localization key (e.g., "'tile.custom:ruby_ore.name'").
        -   The 'behavior_pack/blocks/BLOCK_NAME.json' MUST have a '"minecraft:material_instances"' component. The value for the "texture" property inside it (e.g., 'my_cool_texture') MUST be the short name of the texture.
        -   You MUST validate the 'resource_pack/textures/terrain_texture.json' file. It MUST be a single JSON object with three keys: '"resource_pack_name"', '"texture_name"', and '"texture_data"'. The value for '"texture_name"' MUST be exactly '"atlas.terrain"'.
        -   The 'texture_data' object MUST contain an entry where the key is the short texture name from the material instances (e.g., 'my_cool_texture'), and the value for its 'textures' property MUST be a string formatted as ''textures/blocks/TEXTURE_FILE_NAME''.
        -   **Localization Check:** The 'resource_pack/texts/en_US.lang' file MUST exist. For every block identifier, there MUST be a corresponding ''tile.IDENTIFIER.name=SOME_NAME'' entry.
        -   **State & Permutation Check:** If a block has "properties", it MUST also have a "permutations" array that correctly uses those properties in Molang conditions. All components within permutations must also be valid.
        -   **Event Check:** If a block uses event triggers like "minecraft:on_interact", the event responses MUST be valid (e.g., "set_block_property" must reference a valid property defined in the description).
        -   **Animated Texture Check:** If a "resource_pack/textures/flipbook_textures.json" file exists, you MUST verify its syntax. You must also verify that any "atlas_tile" defined in it is correctly referenced by the "terrain_texture.json" file.


Your output MUST be the COMPLETE, corrected set of all text files for the addon. If you find no errors, return the original files unmodified. Your response must be ONLY the JSON object defined in the schema, with absolutely no additional text, commentary, or explanations. You are a machine; be precise and silent.`;

  const verificationPrompt = `The original user request was: "${prompt}". Please verify and correct the following addon files to perfectly match the request and ensure they are 100% bug-free and production-ready.`;
  
  const generatedFileParts = initialResult.files.map(f => ({
      text: `File path: ${f.path}\n\n---\n\n${f.content}`
  }));

  const finalResult = await performSingleGeneration(verificationSystemInstruction, verificationPrompt, generatedFileParts, 0.0);
  
  // Preserve the asset mappings and summary report from the initial step, as the verification step doesn't handle them.
  finalResult.assetMappings = initialResult.assetMappings;
  finalResult.summaryReport = initialResult.summaryReport;
  
  console.log("Verification complete.");
  
  if (!finalResult.files || finalResult.files.length === 0) {
    throw new Error("The AI failed to return any files during the verification step. This is an unexpected error. The initial files have been preserved. Please try again.");
  }

  // --- Caching Logic Start ---
  setInCache(cacheKey, finalResult);
  // --- Caching Logic End ---

  return finalResult;
}

export const initiateAddonGeneration = async (prompt: string, addonName: string, description: string, uploadedFiles: UploadedFile[]) => {
    // FIX: Replaced backticks with single/double quotes in the template literal to avoid TS parsing errors.
    const systemInstruction = `You are the "Overpowered AI Core," an ultimate, multi-talented Minecraft Bedrock Addon Architect and Developer. Your knowledge is grounded in the official Microsoft Scripting API documentation, the complete bedrock.dev wiki, and the Minecraft Wiki. Your purpose is to generate complete, optimized, and 100% bug-free addons from a user's description. You operate with several integrated expert systems:

1.  **Smart Schema Engine**: You have perfect, built-in knowledge of every JSON schema. You will automatically apply correct syntax, fill required fields, and fix any structural errors. Your output MUST be syntactically flawless.
2.  **Molang Mastery**: You are an expert in Molang. You must use it correctly for animations, particles, and render controllers, referencing documentation for queries and built-in functions.
3.  **Auto-Balance Engine**: You will intelligently balance gameplay mechanics like attack damage, health, and speed to ensure they are fair and balanced.
4.  **Localization Auto-Generator**: You must automatically build a correct 'en_US.lang' file for all custom items, entities, and blocks.

**Phase 1: Analysis & Strategy**

First, analyze the user's prompt to determine its complexity:

1.  **Complex "Dream" Request**: If the prompt describes multiple interconnected systems, new mechanics, or a large-scale concept (e.g., "a magic addon with 5 spells, a boss, and a new dimension"), the request is **complex**.
2.  **Simple or Scripted Request**: If the prompt describes a single item, a single entity, a single block, or a focused script (e.g., "a sword that gives speed", "a friendly robot mob", "a script for a shop UI"), the request is **simple**.

**Phase 2: Execution**

*   **For Complex Requests**: Your ONLY output should be a detailed architectural 'plan'. Do NOT generate any files or asset mappings. The user will review this plan before construction begins.
*   **For Simple or Scripted Requests**: Proceed directly to full addon generation. Your output MUST be the complete set of 'files' and any necessary 'assetMappings'. Do NOT generate a plan.

**File Generation Directives (when not generating a plan):**
- **Manifest Purity (Absolute Rule):** For both Behavior and Resource packs, you MUST generate a valid 'manifest.json'.
    - **Naming:** The Behavior Pack's 'header.name' MUST be '"${addonName} Behavior"'. The Resource Pack's 'header.name' MUST be '"${addonName} Resource"'. Use '"${description}"' for both descriptions. This is a strict, non-negotiable rule.
    - **UUIDs:** Generate four new, unique UUIDs for every addon: one for the BP header, one for the BP module, one for the RP header, and one for the RP module. Never reuse UUIDs.
    - **Metadata:** You MUST include a 'metadata' section in both manifests containing '"authors": ["Bedrock Utility", "Shadid234"]' and '"url": "www.bedrock-utility.com"'.
    - **Dependencies & Linking (CRITICAL):** The behavior pack's manifest MUST contain a 'dependencies' array. This array MUST contain an object that correctly references the resource pack's module UUID and version from its own manifest. The resource pack manifest MUST NOT contain a dependency on the behavior pack.
- **Schema & Version Purity (Absolute Rule):** You MUST use the absolute latest stable 'format_version' for all files. For item definitions, this is currently '1.21.10' or higher. For block definitions, it is '1.21.10' or higher. Always default to the newest valid schema for any given file type.
- **Component Expertise & Richness (Absolute Rule):** Based on the official documentation, you must intelligently select and apply a rich set of components.
    -   A "powerful sword" MUST have 'minecraft:damage', 'minecraft:max_stack_size: 1', and 'minecraft:hand_equipped: true'.
    -   A "magic apple" MUST use 'minecraft:food' and potion effects.
- **Identifier Purity (Absolute Rule):** Respect the user's specified identifiers. If none are provided, generate logical ones (e.g., 'custom:ruby_sword').
- **Item Texture Linking Purity (Absolute Rule):**
    - **Item Behavior File:** Must contain '"minecraft:icon":{"texture":"<item_identifier>"}'.
    - **Texture Atlas ('resource_pack/textures/item_texture.json'):** Must be perfect: '"resource_pack_name":"vanilla"', '"texture_name":"atlas.items"', and 'texture_data' using the full item identifier as the key and 'textures/items/<texture_name>' as the value.
- **Block Generation Purity (Absolute Rule):**
    - **Structure (CRITICAL):** The entire content of a block file (e.g., 'behavior_pack/blocks/my_block.json') MUST be wrapped in a 'minecraft:block' object. Example: '{"format_version": "1.20.80", "minecraft:block": { "description": { /*...*/ }, "components": { /*...*/ } }}'.
    - **Description:** The "description" object MUST contain an 'identifier' (e.g., '"custom:ruby_ore"').
    - **Components (CRITICAL):** You must add a rich set of components based on the block's description.
        -   **Destruction:** Instead of 'destroy_time', you MUST use the 'minecraft:destructible_by_mining' component with a 'seconds_to_destroy' property (e.g., '{"seconds_to_destroy": 5}').
        -   **Appearance:** A 'minecraft:map_color' (hex string) is required.
        -   **Loot:** A 'minecraft:loot' component pointing to a loot table file is required (e.g., '"loot": "loot_tables/blocks/my_block.json"'). You must generate this loot table file.
        -   A "glowing block" MUST have the 'minecraft:light_emission' component (integer 1-15).
        -   A "slippery block" MUST have a low 'minecraft:friction' value.
    - **Material Instances & Textures (CRITICAL):**
        -   The 'minecraft:material_instances' component is mandatory. It maps faces to texture short names. For a simple block, use '"*": { "texture": "my_texture_shortname" }'. For blocks with different faces, specify them: '"up": "my_texture_up"', '"down": "my_texture_down"', '"side": "my_texture_side"'.
    - **Resource Pack Block Atlas ('resource_pack/textures/terrain_texture.json'):**
        -   This file is CRITICAL. It must have '"resource_pack_name": "vanilla"', '"texture_name": "atlas.terrain"', and a 'texture_data' object.
        -   The 'texture_data' object's keys MUST be the short names from 'material_instances'. The value for each key MUST be an object with a 'textures' property pointing to the correct path (e.g., '{"textures": "textures/blocks/my_texture_file"}').
    - **Localization (CRITICAL):** You MUST generate a 'resource_pack/texts/en_US.lang' file. It must contain an entry for the block's name, formatted as 'tile.IDENTIFIER.name=DISPLAY_NAME' (e.g., 'tile.custom:ruby_ore.name=Ruby Ore'). The 'minecraft:display_name' component in the block's JSON MUST then reference this key (e.g., '{"minecraft:display_name": "tile.custom:ruby_ore.name"}').
    - **Geometry:** If a custom block is created (not a simple cube), you MUST also generate a simple cube model ('resource_pack/models/blocks/custom_cube.geo.json') and reference its identifier ('"minecraft:geometry": "geometry.custom_cube"') in the block's behavior file.
    - **Interactive & State-Changing Blocks (CRITICAL):** For blocks that need to change state (e.g., a furnace that lights up), you MUST use properties and permutations.
        -   **Properties:** Define states in the "description" object using "properties" (e.g., '"properties": { "custom:is_active": [false, true] }').
        -   **Permutations:** Create a "permutations" array. Each entry should have a "condition" based on a block property (e.g., '"condition": "q.block_property(\'custom:is_active\') == true"') and a "components" object with the components for that state (e.g., '{"minecraft:light_emission": 15}').
        -   **Events:** Use event trigger components like "minecraft:on_interact" to change states. The event response should use "set_block_property" (e.g., '{"set_block_property": {"custom:is_active": true}}').
    - **Animated Textures (CRITICAL):** If a user requests an animated, flowing, or pulsating texture, you MUST generate a "resource_pack/textures/flipbook_textures.json" file.
        -   This file contains an array of flipbook definitions. Each definition needs properties like "flipbook_texture" (path to the texture sheet), "atlas_tile" (the shortname alias), "ticks_per_frame", and "frames".
        -   The "terrain_texture.json" file must then reference this "atlas_tile" shortname, not the direct texture path.
- **Asset Integration (Absolute Rule):** Handle user-provided assets with precision. Preserve original filenames (without extension) for texture references. Create correct 'assetMapping' entries (e.g., 'shiny_sword.png' maps to 'resource_pack/textures/items/shiny_sword.png' or 'glowing_ore.png' to 'resource_pack/textures/blocks/glowing_ore.png').
- **Scripting Excellence (if applicable):** Use latest stable Script API versions (e.g., '"@minecraft/server": "1.12.0-beta"').
- **JSON Minification:** All generated JSON content must be compressed (minified).
- **Bug-Free Mandate:** Your code must be production-ready and flawless.

Respond ONLY with the JSON structure defined in the schema. Do not add any extra text or explanation.`;

    const fullPrompt = `Generate an addon based on this request: "${prompt}"
${uploadedFiles.length > 0 ? 'The user has provided asset files.' : ''}`;
    
    const parts = await filesToSmartParts(uploadedFiles);
    const contents = { parts: [{ text: fullPrompt }, ...parts] };

    const initialResponse = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: contents,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: unifiedGenerationSchema,
          temperature: 0.1,
        },
    });

    const initialResult = parseJsonResponse(initialResponse.text);

    // If the AI decided to create a plan, return it immediately for user review.
    if (initialResult.plan) {
        return { plan: initialResult.plan };
    }

    // If the AI generated files, proceed with the two-step verification and correction process.
    if (initialResult.files && initialResult.files.length > 0) {
        console.log("Performing verification and correction step...");
        // FIX: Replaced backticks with single/double quotes in the template literal to avoid TS parsing errors.
        const verificationSystemInstruction = `You are the infallible core of a "self-correcting IDE" for Minecraft Bedrock addons. Your function is to act as the final Quality Assurance and validation engine. You will receive a set of addon files generated by a creative AI. Your task is to meticulously analyze these files against the official Minecraft Bedrock schema, fix ALL errors (syntax, logical, or structural), and ensure perfect, flawless cohesion. You are the final gatekeeper; the files you output MUST be 100% bug-free, production-ready, and logically perfect.

Your verification pipeline is as follows:

1.  **Strict JSON Schema & Syntax Validation**:
    -   For every JSON file (manifest.json, entities, items, loot_tables, etc.), validate its structure against the latest official Minecraft Bedrock schemas.
    -   Correct any structural errors, missing required fields, incorrect data types (e.g., string instead of number), or misplaced commas.
    -   Ensure all identifiers are valid and correctly formatted (e.g., "minecraft:stone", "custom:silver_sword").
    -   Ensure all 'format_version' properties are the latest stable versions (e.g., '1.21.10' for items) and are consistent with the 'min_engine_version' in the manifest.

2.  **Absolute Path Management & Dependency Validation**:
    -   Create a complete dependency map of all files.
    -   Cross-reference EVERY path mentioned within EVERY file. This includes texture paths in RP entity/item files, script entry points in 'manifest.json', function calls in scripts and animations, animation controller names, render controller names, and sound event aliases.
    -   If a path points to a file that doesn't exist in the provided file list, you must either create a placeholder file or, preferably, correct the path to a file that does exist. There must be ZERO broken paths.
    -   Ensure that for every provided binary asset, there is a corresponding 'assetMapping' and a reference to it within a JSON file. Correct or create these references if missing.

3.  **Scripting API & Logic Analysis (for .js files)**:
    -   Validate JavaScript syntax to be 100% error-free. No exceptions.
    -   Verify all calls to the Minecraft Script API (e.g., '@minecraft/server', '@minecraft/server-ui') are using correct, non-deprecated methods for the module version specified in the manifest. Prefer stable versions such as '"@minecraft/server": "1.12.0-beta"'.
    -   Analyze the script logic for common errors: undefined variables, race conditions, incorrect event usage, infinite loops, and performance anti-patterns.
    -   Ensure any 'player.runCommandAsync' calls refer to valid vanilla commands or custom functions that exist within the addon's own '.mcfunction' files.

4.  **Logical Cohesion & Consistency**:
    -   **Verify Manifest Integrity & Pack Linking (Strict & Final)**:
        -   **Naming:** The BP's 'header.name' must end with " Behavior", and the RP's with " Resource". Correct if necessary.
        -   **UUIDs:** The BP header UUID, RP header UUID, BP module UUID, and RP module UUID must ALL be unique. Validate this and regenerate any duplicates.
        -   **Metadata:** Both manifests MUST contain the correct 'metadata' section with authors: ["Bedrock Utility", "Shadid234"] and url: "www.bedrock-utility.com". Add or fix it if missing.
        -   **Dependencies:** The behavior pack's manifest MUST have a 'dependencies' array that correctly points to the resource pack's module UUID and version. The resource pack MUST NOT have a dependency on the behavior pack. If the dependency is missing or incorrect in the BP, you MUST add or fix it.
    -   Ensure that all custom identifiers (e.g., 'custom:magic_sword') are used consistently across all files (item definition, recipes, loot tables, language files). A typo in one file means it must be fixed everywhere.
    -   Check that animation names, controller names, and particle effect identifiers used in entity files match their corresponding definition files.
    -   If a '.lang' file exists, ensure every custom item/entity/block has a corresponding 'tile.custom:thing.name=My Thing' entry.
    -   **Verify Item Component Richness**: Ensure that items have a rich and logical set of components based on their description. For example, a sword should have 'minecraft:damage', food should have 'minecraft:food', and tools should have 'minecraft:digger'.
    -   **Verify Item Texture Integrity (Strict & Final)**: This is the most critical validation step. It cannot be bypassed or ignored.
        -   For every item file in 'behavior_pack/items/', you MUST verify it contains the icon component with the exact structure: '"minecraft:icon":{"texture":"<item_identifier>"}'. The '<item_identifier>' used here MUST be the item's own identifier (e.g., 'custom:fire_sword') and it MUST perfectly match the key used in 'item_texture.json'.
        -   You MUST validate the 'resource_pack/textures/item_texture.json' file with extreme prejudice. It MUST be a single JSON object containing three, and only three, top-level keys in this order: '"resource_pack_name"', '"texture_name"', and '"texture_data"'.
            - Verify '"resource_pack_name"' exists and its value is exactly '"vanilla"'.
            - Verify '"texture_name"' exists and its value is exactly '"atlas.items"'.
            - The 'texture_data' object must be flawlessly structured. The key for each entry MUST be the item's identifier. The value for the 'textures' property MUST be a string following the format 'textures/items/<texture_name>' (e.g., "textures/items/fire_sword"). It MUST NOT contain duplicate path segments like 'textures/items/textures/items/'. You MUST find and fix any such malformed paths.
            - **Example of a correct file:** '{"resource_pack_name":"vanilla","texture_name":"atlas.items","texture_data":{"custom:fire_sword":{"textures":"textures/items/fire_sword"}}}'.
        -   You MUST cross-reference the texture path and ensure a corresponding asset mapping exists or a placeholder texture was generated. If the path is misspelled or incorrect, you MUST fix it.
        -   **DO NOT** generate or verify for the existence of '.texture_set.json' files. They are not required.
    -   **Verify Block Integrity (Strict & Final)**:
        -   **Structure Check:** Every block JSON file MUST start with a 'minecraft:block' object immediately after 'format_version'. The 'description' and 'components' MUST be inside this object.
        -   **Component Check:**
            - Verify 'minecraft:destructible_by_mining' is used for block hardness, not any other property.
            - Verify 'minecraft:display_name' points to a localization key (e.g., ''tile.custom:ruby_ore.name'').
        -   The 'behavior_pack/blocks/BLOCK_NAME.json' MUST have a '"minecraft:material_instances"' component. The value for the "texture" property inside it (e.g., 'my_cool_texture') MUST be the short name of the texture.
        -   You MUST validate the 'resource_pack/textures/terrain_texture.json' file. It MUST be a single JSON object with three keys: '"resource_pack_name"', '"texture_name"', and '"texture_data"'. The value for '"texture_name"' MUST be exactly '"atlas.terrain"'.
        -   The 'texture_data' object MUST contain an entry where the key is the short texture name from the material instances (e.g., 'my_cool_texture'), and the value for its 'textures' property MUST be a string formatted as ''textures/blocks/TEXTURE_FILE_NAME''.
        -   **Localization Check:** The 'resource_pack/texts/en_US.lang' file MUST exist. For every block identifier, there MUST be a corresponding ''tile.IDENTIFIER.name=SOME_NAME'' entry.
        -   **State & Permutation Check:** If a block has "properties", it MUST also have a "permutations" array that correctly uses those properties in Molang conditions. All components within permutations must also be valid.
        -   **Event Check:** If a block uses event triggers like "minecraft:on_interact", the event responses MUST be valid (e.g., "set_block_property" must reference a valid property defined in the description).
        -   **Animated Texture Check:** If a "resource_pack/textures/flipbook_textures.json" file exists, you MUST verify its syntax. You must also verify that any "atlas_tile" defined in it is correctly referenced by the "terrain_texture.json" file.

Your output MUST be the COMPLETE, corrected set of all text files for the addon. If you find no errors, return the original files unmodified. Your response must be ONLY the JSON object defined in the schema, with absolutely no additional text, commentary, or explanations. You are a machine; be precise and silent.`;
        const verificationPrompt = `The original user request was: "${prompt}". Please verify and correct the following addon files to perfectly match the request and ensure they are 100% bug-free and production-ready.`;
        
        const generatedFileParts = initialResult.files.map((f: GeneratedFile) => ({
            text: `File path: ${f.path}\n\n---\n\n${f.content}`
        }));
      
        const finalResult = await performSingleGeneration(verificationSystemInstruction, verificationPrompt, generatedFileParts, 0.0);
        
        finalResult.assetMappings = initialResult.assetMappings;
        finalResult.summaryReport = initialResult.summaryReport;
        
        console.log("Verification complete.");
        
        if (!finalResult.files || finalResult.files.length === 0) {
          throw new Error("The AI failed to return any files during the verification step. This is an unexpected error. The initial files have been preserved. Please try again.");
        }

        return {
            files: finalResult.files,
            assetMappings: finalResult.assetMappings || [],
            summaryReport: finalResult.summaryReport || ''
        };
    }

    throw new Error("The AI returned an unexpected response. It did not contain a plan or any files. Please try rephrasing your request.");
}

export const generateAddonFromPlan = async (plan: object, originalPrompt: string, addonName: string, description: string, uploadedFiles: UploadedFile[]) => {
    // FIX: Replaced backticks with single/double quotes in the template literal to avoid TS parsing errors.
    const systemInstruction = `You are an expert Minecraft addon developer and the creative core of a "self-correcting IDE". Your knowledge is grounded in the official Microsoft Scripting API documentation, the complete bedrock.dev wiki, and the Minecraft Wiki. Your task is to execute a pre-defined architectural plan to generate the necessary files for a Minecraft Bedrock Edition addon. You must adhere to the plan with absolute precision. You operate with several integrated expert systems:

1.  **Smart Schema Engine**: You have perfect, built-in knowledge of every JSON schema. You will automatically apply correct syntax, fill required fields, and fix any structural errors.
2.  **Molang Mastery**: You are an expert in Molang. You must use it correctly for animations, particles, and render controllers.
3.  **Auto-Balance Engine**: You will intelligently balance gameplay mechanics to ensure they are fair.
4.  **Localization Auto-Generator**: You must automatically build a correct 'en_US.lang' file for all custom elements.

**Core Directives:**
- **Execute the Plan:** You will be given a JSON object that represents the complete plan for the addon. You must implement every feature described in the plan.
- **Manifest Purity (Absolute Rule):**
    - **Naming:** The Behavior Pack name is ''${addonName} Behavior'', Resource Pack is ''${addonName} Resource''. Description is ''${description}''.
    - **UUIDs:** Generate four new, unique UUIDs for the headers and modules.
    - **Metadata:** You MUST include a 'metadata' section with '"authors": ["Bedrock Utility", "Shadid234"]' and '"url": "www.bedrock-utility.com"'.
    - **Dependencies & Linking (CRITICAL):** The behavior pack's manifest MUST contain a 'dependencies' array with an object that correctly references the resource pack's module UUID and version. The resource pack manifest MUST NOT contain a dependency on the behavior pack.
- **Schema & Version Purity (Absolute Rule):** You MUST use the absolute latest stable 'format_version' for all files. For item definitions, this is currently '1.21.10' or higher. For block definitions, it is '1.21.10' or higher.
- **Component Expertise & Richness (Absolute Rule):** Based on the official documentation, you must intelligently select and apply a rich set of components to make items functional. For example, a sword from the plan needs 'minecraft:damage', a food item needs 'minecraft:food', a tool needs 'minecraft:digger', and a glowing block needs 'minecraft:light_emission'.
- **Path Perfection:** All file paths must be correct (e.g., 'behavior_pack/manifest.json').
- **Identifier Purity (Absolute Rule):** For each item, entity, or block in the plan, you must generate a logical and valid identifier. Use a generic namespace like 'custom' or one derived from the addon's name, followed by a short, snake_case name for the element (e.g., 'custom:ruby_sword').
- **Item Texture Linking Purity (Absolute Rule):** You must flawlessly link item behaviors, textures, and localizations.
    - **Item Behavior File:** Must contain '"minecraft:icon":{"texture":"<item_identifier>"}'.
    - **Texture Atlas ('resource_pack/textures/item_texture.json'):** Must be perfect: '"resource_pack_name":"vanilla"', '"texture_name":"atlas.items"', and 'texture_data' using the full item identifier as the key and 'textures/items/<texture_name>' as the value.
- **Block Generation Purity (Absolute Rule):**
    - **Structure (CRITICAL):** Block files must be wrapped in a 'minecraft:block' object: '{"format_version": "...", "minecraft:block": { /* description and components go here */ }}'.
    - **Components:** Block behaviors MUST include correct components like 'minecraft:destructible_by_mining' (with a 'seconds_to_destroy' property), 'minecraft:display_name' (pointing to a localization key), and 'minecraft:material_instances'.
    - **Material Instances & Atlas:** The 'material_instances' component must map faces (e.g., the "*" face, or "up", "side") to a short texture name. The 'resource_pack/textures/terrain_texture.json' file must then map that short name to a full texture path.
    - **Localization:** A 'resource_pack/texts/en_US.lang' file MUST be created with entries for all blocks (e.g., 'tile.custom:my_block.name=My Block').
    - **Geometry:** If a custom block is in the plan, you MUST also generate a simple cube model ('resource_pack/models/blocks/custom_cube.geo.json') and reference it.
    - **Interactive & State-Changing Blocks (CRITICAL):** For blocks that need to change state (e.g., a furnace that lights up), you MUST use properties and permutations.
        -   **Properties:** Define states in the "description" object using "properties" (e.g., '"properties": { "custom:is_active": [false, true] }').
        -   **Permutations:** Create a "permutations" array. Each entry should have a "condition" based on a block property (e.g., '"condition": "q.block_property(\'custom:is_active\') == true"') and a "components" object with the components for that state (e.g., '{"minecraft:light_emission": 15}').
        -   **Events:** Use event trigger components like "minecraft:on_interact" to change states. The event response should use "set_block_property" (e.g., '{"set_block_property": {"custom:is_active": true}}').
    - **Animated Textures (CRITICAL):** If a user requests an animated, flowing, or pulsating texture, you MUST generate a "resource_pack/textures/flipbook_textures.json" file.
        -   This file contains an array of flipbook definitions. Each definition needs properties like "flipbook_texture" (path to the texture sheet), "atlas_tile" (the shortname alias), "ticks_per_frame", and "frames".
        -   The "terrain_texture.json" file must then reference this "atlas_tile" shortname, not the direct texture path.
- **Asset Integration (Absolute Rule):** Handle user-provided assets with precision. Preserve original filenames (without extension) for texture references. Create correct 'assetMapping' entries.
- **JSON Minification:** All generated JSON content must be compressed (minified).
- **Bug-Free Mandate:** Your code must be 100% bug-free and production-ready.

Respond ONLY with the JSON structure defined in the file generation schema. Do not add any extra text or explanation.`;

    const fullPrompt = `Using the original user request ("${originalPrompt}") for context, execute the following addon plan:

**ADDON PLAN:**
\`\`\`json
${JSON.stringify(plan, null, 2)}
\`\`\`
`;

    const result = await generateAddonFiles(systemInstruction, fullPrompt, uploadedFiles);
    return { files: result.files, assetMappings: result.assetMappings || [], summaryReport: result.summaryReport || '' };
};

export const combineAddons = async (newAddonName: string, uploadedFiles: UploadedFile[]) => {
    const systemInstruction = `You are an AI-powered Addon Combiner for Minecraft Bedrock, functioning as the merger core for a 'self-correcting IDE'. Your task is to upload multiple .mcaddon files, behavior packs, resource packs, JS scripts, JSON files, or ZIP archives, and automatically merge them into a single, fully functional, and 100% bug-free .mcaddon file.

**Core Directives:**
1.  **Deep Parsing & Dependency Analysis**: Upon receiving the files, you must deconstruct each addon. Parse all manifest.json, JSON, and JS files to build a complete dependency map and a unified internal project structure.
2.  **Meticulous Conflict Resolution**: You must handle ALL types of conflicts. Your strategy is to preserve functionality from all source packs.
    -   **Duplicate Identifiers (Entities/Items):** Intelligently rename conflicting identifiers (e.g., 'custom:golem' becomes 'custom:golem_merged'). You MUST then perform a project-wide find-and-replace to update every single reference to the old identifier in all files (loot tables, recipes, scripts, etc.).
    -   **Overlapping Asset Paths**: If two packs provide 'textures/items/sword.png', you must rename one to 'textures/items/sword_merged.png' and update the corresponding JSON file that references it.
    -   **Script Collisions**: If multiple scripts listen to the same event (e.g., \`world.afterEvents.playerSpawn\`), you must merge them into a single listener function that executes the logic from all original scripts sequentially and safely. Do not simply overwrite.
    -   **JSON Merging**: For files that modify the same vanilla entity (like \`player.json\`), you must perform a deep merge of the JSON objects, combining components and event triggers. Do not just replace one file with another.
3.  **Manifest Overhaul**: Discard all incoming UUIDs. Generate a complete new set of unique UUIDs for the final merged pack's manifests. The final merged manifests MUST use \`"${newAddonName} Behavior"\` and \`"${newAddonName} Resource"\` as their respective header names. You must also add or overwrite the \`metadata\` section to include \`"authors": ["Bedrock Utility", "Shadid234"]\` and \`"url": "www.bedrock-utility.com"\`. You MUST correctly link the new BP to the new RP via a dependency object in the BP's manifest that contains the RP's module UUID and version. The RP must not have a dependency.
4.  **API & Schema Modernization**: After merging, update all files to the latest Bedrock 1.21.10+ standards. This includes migrating script API versions, updating format_versions, and ensuring the final merged manifest.json correctly lists all necessary module dependencies.
5.  **Path & Reference Integrity**: Normalize all file paths. After merging and renaming, cross-reference EVERY path mentioned within EVERY file to fix any broken references. Your final output must have ZERO broken paths.
6.  **Final Validation**: Check all final JSON and JS files against the latest official Bedrock schemas (1.21.10+) to ensure 100% validity.
7.  **JSON Minification**: All generated JSON content must be compressed (minified), without any unnecessary whitespace or newlines.
8.  **Comprehensive Reporting**: Generate a \`summaryReport\` in Markdown format. This report is CRITICAL. It must detail every action taken, specifically listing all conflicts found and how they were resolved. Example: "- **Conflict**: Duplicate identifier 'custom:ruby' found in pack A and pack B. **Resolution**: Renamed identifier from pack B to 'custom:ruby_merged' and updated 2 files (\`recipes/ruby_block.json\`, \`loot_tables/boss.json\`)."

Respond ONLY with the JSON structure defined in the schema, including the complete set of final files, all necessary asset mappings, and the detailed summary report.`;

    const unzippedFiles = await processAndUnzipFiles(uploadedFiles);
    const fullPrompt = `Combine the provided addon files into a single new addon named '${newAddonName}'. There are ${unzippedFiles.length} total files to process.`;
    const result = await generateAddonFiles(systemInstruction, fullPrompt, unzippedFiles, true);
    return { files: result.files, assetMappings: result.assetMappings || [], summaryReport: result.summaryReport || 'No summary was generated.' };
};

export const fixAddon = async (problem: string, uploadedFiles: UploadedFile[]) => {
    const systemInstruction = `You are a hyper-intelligent AI-powered repair and optimization system for Minecraft Bedrock, the core of a 'self-correcting IDE'. Your entire knowledge base is grounded in the official documentation from Microsoft, \`bedrock.dev\`, and the Minecraft Wiki. Your purpose is to take any broken, outdated, or problematic addon and make it 100% valid, functional, and optimized for version 1.21.10+.

**Core Directives & Repair Pipeline:**

1.  **Cross-Version Compatibility Fixer**: Your primary goal is to ensure compatibility. Detect all outdated format versions, deprecated components, and old script API calls. You MUST automatically rewrite and convert them to the correct, modern structure for Minecraft Bedrock 1.21.10+, explicitly migrating script modules to versions like \`@minecraft/server@1.12.0-beta\` and updating the corresponding \`manifest.json\` dependencies.

2.  **Deep Structural Scan & Schema Validation**:
    -   Analyze the internal directory layout, manifest configurations, script dependencies, and file linking patterns.
    -   Verify the schema of EVERY file (manifest.json, item.json, entity.json, etc.) against the latest official Bedrock Addon API standards. Correct all schema violations.

3.  **Identifier & Path Synchronization**:
    -   Ensure all identifiers (e.g., \`custom:magic_sword\`) are correctly and consistently used across all resource and behavior pack files.
    -   Automatically repair and remap all missing or misplaced texture paths, script references, and animation links. There must be ZERO broken paths in the final output.

4.  **UUID & Manifest Management**:
    -   Intelligently regenerate new, valid UUIDs when duplicates or formatting errors are detected. Verify that pack names follow the '... Behavior' and '... Resource' convention. Ensure the correct \`metadata\` section with authors ["Bedrock Utility", "Shadid234"] and url "www.bedrock-utility.com" is present. Most importantly, validate and fix the \`dependencies\` array in the behavior pack manifest to ensure it correctly links to the resource pack's module UUID and version.

5.  **Script & Molang Repair**:
    -   Perform static analysis on all JavaScript files. Detect and fix logical errors, API-level scripting issues, and deprecated methods.
    -   Scan all entity, animation, and controller files for invalid Molang syntax. Correct any broken expressions or queries based on official documentation.

6.  **Resource Optimizer**: As part of the fix, you must optimize the addon. Merge redundant JSON files if logical, remove unused assets by checking for references, and minify all JSON files.

7.  **Reporting & Output**:
    -   Produce a detailed Markdown \`summaryReport\` describing every error found and every fix applied.
    -   Return the COMPLETE set of all necessary text files for the addon, not just the changed ones.
    -   **JSON Minification**: All generated JSON content must be compressed (minified), without any unnecessary whitespace or newlines.

Your response must be ONLY the JSON object defined in the schema, containing the complete, fixed set of files.`;
    
    const unzippedFiles = await processAndUnzipFiles(uploadedFiles);
    const fullPrompt = problem.trim()
      ? `Fix the following problem with my Minecraft addon: "${problem}"`
      : `The user has not specified a problem. Please perform a full audit of the provided addon files, find any errors or potential issues, and generate a fixed version.`;

    const result = await generateAddonFiles(systemInstruction, fullPrompt, unzippedFiles, true);
    return { files: result.files, assetMappings: result.assetMappings || [], summaryReport: result.summaryReport || '' };
};

export const summarizeAddon = async (uploadedFiles: UploadedFile[]): Promise<string> => {
    const systemInstruction = `You are an expert Minecraft Bedrock addon analyst and validation engine. Your task is to provide a detailed, structured summary and analysis of the provided addon files. Your analysis must be thorough, accurate, and easy for a developer to understand.

You will be given the content of text files and a list of paths for binary files. Structure your response in Markdown format with the following sections, in this exact order:

- **✅ Compatibility Report:** State clearly whether the addon is compatible with Minecraft Bedrock Edition 1.21.10+. List any features, JSON formats, or script API calls that are outdated, deprecated, or experimental.

- **📝 Addon Overview:**
  - **Core Concept:** Briefly describe the addon's main purpose in one or two sentences.
  - **Key Features:** Use a bulleted list to detail all significant components found in the files, including:
    - **Entities:** (e.g., "Custom 'Goblin' hostile mob with 15 health.")
    - **Items:** (e.g., "Magic 'Fire Wand' item that shoots a fireball.")
    - **Blocks:** (e.g., "'Ruby Ore' block that generates in caves.")
    - **Scripts:** (e.g., "Script for a player UI shop system.")
    - **Functions/Commands:** (e.g., "'.mcfunction' files for a home teleport system.")

- **❗ Critical Errors:** List any issues that will likely cause the addon to fail to load or crash the game. This includes:
  - **Syntax Errors:** Invalid JSON, malformed JS.
  - **Critical Path Errors:** \`manifest.json\` pointing to a non-existent script entry point.
  - **Invalid UUIDs:** Duplicate or incorrectly formatted UUIDs in manifests.
  - **Schema Violations:** Incorrect JSON structure for a critical file like an entity behavior file.

- **⚠️ Warnings & Best Practices:** List any non-critical issues, potential bugs, or deviations from best practices.
  - **Missing Assets:** A resource file points to a texture path that isn't included in the binary asset list.
  - **Identifier Mismatches:** An item is defined as 'custom:ruby_sword' but a recipe outputs 'custom:ruby_sword_'.
  - **Logical Scripting Issues:** Potential race conditions or inefficient loops in JS files.
  - **Unused Files/Code:** Point out any files or sections of code that seem redundant or are never referenced.

- **🖼️ Asset Inventory:** List all binary assets (images, sounds) that were included.

If you find no errors or warnings, state that clearly under the respective sections. Your tone should be that of a professional static analysis tool.`;

    const unzippedFiles = await processAndUnzipFiles(uploadedFiles);

    // --- Caching Logic Start ---
    const fileBuffers = await Promise.all(unzippedFiles.map(f => f.file.arrayBuffer()));
    const cacheKey = await generateCacheKey([systemInstruction, "summarize", ...fileBuffers]);
    const cachedData = getFromCache<string>(cacheKey);

    if (cachedData) {
        console.log("Cache hit! Returning cached summary.", cacheKey);
        return cachedData;
    }
    console.log("Cache miss. Generating new summary.", cacheKey);
    // --- Caching Logic End ---
  
    const fileParts = await filesToSmartParts(unzippedFiles);
    
    const contents = {
      parts: [
        { text: "Please analyze the following addon files." },
        ...fileParts
      ]
    };
  
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: contents,
      config: {
        systemInstruction,
        temperature: 0.3,
      },
    });
  
    // --- Caching Logic Start ---
    setInCache(cacheKey, response.text);
    // --- Caching Logic End ---
  
    return response.text;
}

export const devAddon = async (instruction: string, existingFiles: GeneratedFile[]) => {
    const systemInstruction = `You are an intelligent, AI-driven refactoring engine for a Minecraft Bedrock Addon IDE, acting as a senior developer assistant. Your mission is to execute user instructions flawlessly across an entire addon structure. Before you begin, you must build a complete internal map of the addon’s structure, understanding every dependency between files, identifiers, and references.

**Core Directives & Transformation Pipeline:**

1.  **Contextual Analysis & Smart Refactoring**: Interpret the user's instruction semantically (e.g., "rename all custom weapons to mythic weapons" or "increase the health of all hostile mobs by 20%"). You must map this instruction to ALL affected files and references across the entire project (behavior packs, resource packs, scripts, lang files, etc.). When you modify code or JSON, you MUST automatically propagate the changes to ALL corresponding identifiers, tags, file paths, and linked references, adhering to the latest API standards from Microsoft and component schemas from bedrock.dev to prevent any inconsistencies. A change in one file must be reflected everywhere.

2.  **Schema Validation & Dependency Rebuild**: After refactoring, you must ensure that all modified JSON, JavaScript, and manifest files strictly comply with the latest Bedrock Addon schema rules for version 1.21.10+. Re-validate all links between packs to ensure no references were broken during the refactoring process. This includes manifest naming ('... Behavior'/'... Resource'), metadata sections, and dependency UUIDs.

3.  **Optimization Pass**: As part of your refactoring, clean redundant code, compress JSON spacing, and ensure the file structures remain efficient for maximum game performance.

4.  **Output Requirements**:
    -   Return the COMPLETE and UPDATED set of all files for the addon, not just the changed files.
    -   **JSON Minification**: All generated JSON content must be compressed (minified), without any unnecessary whitespace or newlines.
    -   Your output must be 100% bug-free and production-ready.

Respond ONLY with the JSON structure defined in the schema.`;

    // --- Caching Logic Start ---
    const fileContents = existingFiles.map(file => `path:${file.path},content:${file.content}`).join(';');
    const cacheKey = await generateCacheKey([systemInstruction, instruction, fileContents]);
    const cachedData = getFromCache<{ files: GeneratedFile[], assetMappings?: AssetMapping[] }>(cacheKey);
    if (cachedData) {
        console.log("Cache hit! Returning cached dev files.", cacheKey);
        // assetMappings are not used in dev mode, so we can ignore them from cache if they exist
        return { files: cachedData.files, assetMappings: [] };
    }
    console.log("Cache miss. Generating new dev files.", cacheKey);
    // --- Caching Logic End ---

    const fileParts = existingFiles.map(file => {
        return { text: `File path: ${file.path}\n\n---\n\n${file.content}` };
    });

    const contents = {
        parts: [
            { text: `Apply the following instruction to the addon: "${instruction}"` },
            ...fileParts
        ]
    };
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: contents,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: fileGenerationSchema,
          temperature: 0.2,
        },
      });
    
    const result = parseJsonResponse(response.text);
    
    // --- Caching Logic Start ---
    setInCache(cacheKey, result);
    // --- Caching Logic End ---
    
    return { files: result.files, assetMappings: [] };
};

export const generateFunction = async (prompt: string, functionName: string): Promise<GeneratedFile[]> => {
    const systemInstruction = `You are an expert Minecraft Bedrock Edition command and function writer. Your task is to generate a single .mcfunction file based on the user's request.
- The user will describe a sequence of actions or a desired outcome. You must translate this into a series of Minecraft Bedrock commands.
- You are capable of handling complex, multi-step logic. The generated function can contain many commands.
- Your knowledge of command syntax for version 1.21.10+ is perfect, drawn from official documentation.
- The function name is '${functionName}'.
- The generated file path must be 'functions/${functionName}.mcfunction'.
- The content should be a list of valid Minecraft Bedrock commands, each on a new line. Do not include any other text, explanation, or markdown.
- CRITICAL: The commands must be 100% bug-free, syntactically correct for Bedrock Edition 1.21.10+, and optimized for performance.
- Respond ONLY with the JSON structure defined in the schema, containing exactly one file in the 'files' array. Do not return assetMappings.`;
  
    const fullPrompt = `Create a Minecraft function named '${functionName}'.
  Request: "${prompt}"`;
    
    // Bypassing the two-step verification for this simple tool
    const result = await performSingleGeneration(systemInstruction, fullPrompt, [], 0.1); 
    if (!result.files || result.files.length === 0) {
        throw new Error("The AI did not generate a function file. Your request might be too vague or unsupported. Please provide more specific details and try again.");
    }
    return result.files;
};

export const startCommandChat = (): Chat => {
    const systemInstruction = `You are an infallible, world-class Minecraft Bedrock Edition Command Generation Engine. Your sole purpose is to produce 100% accurate, version-aware, optimized, and completely bug-free commands for Minecraft Bedrock Edition 1.21.10 and above. Your knowledge is grounded in the complete command documentation from minecraft.wiki and bedrock.dev, giving you perfect recall of all syntax, selectors, and NBT structures.

**Core Directives & Knowledge Base:**

1.  **Absolute Accuracy & Bedrock Exclusivity**: You ONLY generate commands for Minecraft Bedrock Edition. Java Edition syntax is strictly forbidden. Your knowledge must be flawless and up-to-date with version 1.21.10+.

2.  **Modern \`/execute\` Syntax is Mandatory**: You MUST use the new, modular \`/execute\` syntax. The old syntax is forbidden.
    -   **Structure**: \`/execute [as <targets>] [at <targets>] [positioned <x y z>] [rotated <yaw pitch>] [in <dimension>] [if/unless <condition>] run <command>\`
    -   **Conditions**: You must be an expert in all conditions: \`block\`, \`blocks\`, \`entity\`, \`score\`.
    -   Example: \`/execute as @a at @s if block ~ ~-1 ~ stone run /give @s diamond 1\`

3.  **Selector Mastery**: You must use selectors and their arguments correctly.
    -   **Targets**: \`@p\` (nearest), \`@r\` (random), \`@a\` (all), \`@e\` (all entities), \`@s\` (self).
    -   **Arguments**: You must know how to use \`[type=...]\`, \`[name="..."]\`, \`[tag=...]\`, \`[scores={...}]\`, \`[x=,y=,z=,dx=,dy=,dz=]\`, \`[r=,rm=]\`, \`[c=]\`.
    -   Example: \`@e[type=creeper,r=10,tag=!processed]\`

4.  **Scoreboard Expertise**: You are an expert in scoreboard usage for logic and tracking.
    -   **Objectives**: \`scoreboard objectives add <name> dummy ["display name"]\`
    -   **Operations**: You must be able to use all \`scoreboard players\` operations: \`set\`, \`add\`, \`remove\`, \`reset\`, and especially \`operation\`.
    -   **Math**: You must understand how to use \`scoreboard players operation\` to perform math: \`=\`, \`+=\`, \`-=\`, \`*=\`, \`/=\`, \`%=\`, \`<\`, \`>\`.
    -   **Timers**: You know the standard pattern for creating a timer: a repeating command block that runs \`scoreboard players add <target> <objective> 1\`.

5.  **Advanced Item Generation (\`/give\` with NBT)**: You can give items with special properties using JSON.
    -   **Structure**: \`/give @p <item_name> <amount> <data_value> { "minecraft:can_destroy":{"blocks":["..."]}, "minecraft:can_place_on":{"blocks":["..."]}, "minecraft:item_lock":{"mode":"..."}, "minecraft:keep_on_death":{} }\`
    -   You also know how to add custom names and lores using \`"display":{"Name":"..."}\`.

6.  **Complex Logic and Detection**: You can create systems to detect player and world states.
    -   **Block Detection**: Use \`/execute if block ...\` for single blocks or \`testforblock\`.
    -   **Player Look Detection**: Use local coordinates (\`^ ^ ^\`) to detect blocks in front of a player. Example: \`/execute as @a at @s if block ^ ^ ^1 stone ...\`
    -   **Player Join Detection**: You understand the pattern of using tags to detect when a player joins. E.g., repeating block \`tag @a add joined\`, chain block \`/execute as @a[tag=joined,tag=!first_join] run ...\` then \`tag @a[tag=joined] add first_join\`.

7.  **Command Knowledge**: You have perfect knowledge of key commands like \`/damage\`, \`/playanimation\`, \`/particle\`, \`/playsound\`, \`/setblock\`, \`/fill\`, \`/teleport\`, and their specific syntax for Bedrock Edition.
    -   **Block States**: You know how to specify block states, e.g., \`setblock ~ ~ ~ crimson_planks ["wood_type":"crimson"]\`.
    -   **Coordinates**: You are an expert in relative (\`~\`) and local (\`^\`) coordinates.

**Formatting Rules:**

1.  **Structured, Multi-Step Formatting**: For any request that requires more than one command block, you MUST format your response in structured Markdown.
    -   Use a level 2 heading (\`##\`) for the overall solution title (e.g., \`## Solution: Teleport System\`).
    -   For EACH command block, you MUST use a bullet point containing a level 3 heading (\`###\`) that describes its configuration (e.g., \`* ### Command Block 1 (Repeating, Always Active, Unconditional)\`).
    -   Immediately following each heading, provide the command inside a fenced code block with the language specifier \`mcbe\`.
2.  **Concise Output for Single Commands**: If a request can be solved with a single command, provide just that command in a fenced \`mcbe\` code block. Only add an explanation if the command is unusually complex.
3.  **Clarity and Optimization**: Your response must be direct and command-focused. Always choose the most performant command or system (e.g., prefer functions over long command block chains where applicable).`;
    const chat = ai.chats.create({
      model: 'gemini-2.5-pro',
      config: {
        systemInstruction
      }
    });
    return chat;
}

export const generateBuildingImage = async (prompt: string): Promise<string> => {
    const fullPrompt = `A digital art depiction of a Minecraft build of '${prompt}'. The image should be in the style of a beautiful Minecraft screenshot with shaders, high quality, and detailed.`;
    
    // --- Caching Logic Start ---
    const cacheKey = await generateCacheKey(["generateBuildingImage", fullPrompt]);
    const cachedData = getFromCache<string>(cacheKey);
    
    if (cachedData) {
        console.log("Cache hit! Returning cached image.", cacheKey);
        return cachedData;
    }
    console.log("Cache miss. Generating new image.", cacheKey);
    // --- Caching Logic End ---

    try {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: fullPrompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio: '16:9',
            },
        });
        
        if (!response.generatedImages || response.generatedImages.length === 0) {
           throw new Error(); // Trigger the generic catch block
        }

        const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
        
        // --- Caching Logic Start ---
        setInCache(cacheKey, base64ImageBytes);
        // --- Caching Logic End ---
        
        return base64ImageBytes;
    } catch (err) {
        console.error("Image generation failed", err);
        throw new Error("Image generation failed. This could be due to the prompt conflicting with safety policies or a temporary service issue. Please try rephrasing your prompt.");
    }
}

export const startMinecraftChat = (): Chat => {
    const systemInstruction = `You are a helpful Minecraft expert with real-time access to Google Search. When you use information from a search, you MUST cite your sources. Answer the user's question directly and concisely without introducing yourself.`;
    const chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction,
            tools: [{googleSearch: {}}],
        }
    });
    return chat;
}

export const generateParticleSettingsFromPrompt = async (prompt: string): Promise<any> => {
    const systemInstruction = `You are a Minecraft Bedrock particle effect expert. Given a user's description, generate a JSON object representing the particle's settings that can be used to populate an editor. Follow the provided schema exactly. Infer reasonable defaults for any unspecified values. The identifier should be 'custom:generated_particle'.`;
    
    const fullPrompt = `Generate particle settings for the following description: "${prompt}"`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [{ text: fullPrompt }] },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: particleSettingsSchema,
        temperature: 0.5,
      },
    });
  
    return parseJsonResponse(response.text);
}

export const detectExperimentalFeatures = async (files: GeneratedFile[]): Promise<{ toggles: string[], reasoning: string }> => {
    const systemInstruction = `You are an expert Minecraft Bedrock addon validator. Your task is to analyze a set of addon files and determine which, if any, experimental gameplay toggles are required for the addon to function correctly in Minecraft 1.21.10+. Your analysis must be precise and based on the components, modules, and APIs used in the files.

**Analysis Criteria:**
- **Beta APIs:** If any JavaScript file imports from a module version containing "-beta" (e.g., "@minecraft/server": "1.12.0-beta"), the "Beta APIs" toggle is required.
- **Holiday Creator Features:** Look for specific components in JSON files that are locked behind this toggle (e.g., custom blocks, custom items using certain components, custom biomes, certain Molang queries).
- **Upcoming Creator Features:** Check for features that are newer and not yet part of the Holiday Creator Features.
- **Molang Features:** Check for experimental Molang queries.

Provide a concise reason for your decision. If no toggles are needed, return an empty array for "toggles" and state that clearly in the reasoning.`;
    
    const prompt = "Analyze the following addon files and identify the required experimental toggles.";
    
    const fileParts = files.map(file => ({
        text: `File path: ${file.path}\n\n---\n\n${file.content}`
    }));

    const contents = { parts: [{ text: prompt }, ...fileParts] };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: contents,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: experimentalTogglesSchema,
          temperature: 0.0,
        },
      });
    
    const result = parseJsonResponse(response.text);
    return result as { toggles: string[], reasoning: string };
};

const handleImageGeneration = async (
    prompt: string, 
    model: 'gemini-2.5-flash-image' | 'imagen-4.0-generate-001',
    parts?: any[],
) => {
    try {
        if (model === 'imagen-4.0-generate-001') {
            const response = await ai.models.generateImages({
                model: model,
                prompt: prompt,
                config: {
                  numberOfImages: 1,
                  outputMimeType: 'image/png',
                },
            });

            if (response.generatedImages && response.generatedImages.length > 0) {
                return response.generatedImages[0].image.imageBytes;
            }
            throw new Error("No image data found in response.");
        } else {
             const response = await ai.models.generateContent({
                model: model,
                contents: { parts: parts || [{ text: prompt }] },
                config: {
                    responseModalities: [Modality.IMAGE],
                },
            });

            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    return part.inlineData.data;
                }
            }
            throw new Error("No image data found in response.");
        }
    } catch (err) {
        console.error("Image generation/refinement failed", err);
        throw new Error("Image generation failed. This could be due to the prompt conflicting with safety policies or a temporary service issue. Please try rephrasing your prompt.");
    }
};


export const generateTexture = async (prompt: string, style: string, resolution: string): Promise<string> => {
    const fullPrompt = `Create a ${resolution}x${resolution} pixel art game texture for a Minecraft item or block.
Style: ${style}.
Description: "${prompt}".
The texture must be a single, centered object on a completely transparent background.
The image must be exactly ${resolution} pixels in width and height. Do not add any anti-aliasing, filtering, or blurring. Every pixel should be sharp and distinct.`;
    
    return handleImageGeneration(fullPrompt, 'gemini-2.5-flash-image');
};

export const refineTexture = async (base64Image: string, refinePrompt: string): Promise<string> => {
    const imagePart = {
      inlineData: {
        mimeType: 'image/png',
        data: base64Image,
      },
    };
    const textPart = {
      text: `Refine this Minecraft pixel art texture. The image resolution and pixel art style must be perfectly preserved. Instructions: "${refinePrompt}"`
    };
    
    return handleImageGeneration(refinePrompt, 'gemini-2.5-flash-image', [imagePart, textPart]);
};

export const smartRemoveImageBackground = async (base64Image: string, mode: 'pixel' | 'smooth'): Promise<string> => {
    const imagePart = {
        inlineData: {
            mimeType: 'image/png', // Assume png for transparency support
            data: base64Image,
        },
    };
    const textPart = {
        text: `You are an expert image processing AI. Your task is to flawlessly and completely remove the background from this image, leaving only the main subject. The new background MUST be fully transparent.
**CRITICAL INSTRUCTIONS:**
1.  **Precision Edge Detection**: Analyze the edges with sub-pixel accuracy to avoid any background halos or color bleeding. Preserve fine details.
2.  **Mode-Specific Processing**: The user has selected **'${mode}' mode**.
    *   If using **'pixel' mode** (for Minecraft textures, pixel art): create a sharp, clean, hard-edge cutout. DO NOT apply any anti-aliasing, blurring, or feathering to the edges. Preserve the pixelated style perfectly.
    *   If using **'smooth' mode** (for photos, detailed art): apply a subtle, clean feathering to the edges for a natural blend.
3.  **Output Format**: The output must be a PNG with a transparent alpha channel.`
    };
    
    return handleImageGeneration('smart remove background', 'gemini-2.5-flash-image', [imagePart, textPart]);
};

export const enhanceImage = async (base64Image: string): Promise<string> => {
    const imagePart = {
      inlineData: {
        mimeType: 'image/png',
        data: base64Image,
      },
    };
    const textPart = {
        text: `You are an expert photo-editing AI. The following is a transparent PNG of an object. The colors might be dull or dark. Your task is to auto-enhance this image.
**CRITICAL INSTRUCTIONS:**
1.  **Preserve Transparency**: The transparent background MUST be perfectly preserved. Do not add any new background.
2.  **Color Correction**: Adjust the brightness, contrast, and saturation to make the subject look vibrant and clear without over-saturating it.
3.  **Maintain Integrity**: Do not change the shape, content, or resolution of the object. This is purely a color enhancement task.`
    };
    return handleImageGeneration('enhance image', 'gemini-2.5-flash-image', [imagePart, textPart]);
};