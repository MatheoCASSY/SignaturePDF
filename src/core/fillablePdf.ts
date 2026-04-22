import {
  getDefaultFont,
  getFallbackFontName,
  type Font,
  type Schema,
  type Template,
} from '@pdfme/common';

function getFontNoSubset(): Font {
  const font = getDefaultFont();
  return Object.fromEntries(
    Object.entries(font).map(([name, value]) => [name, { ...value, subset: false }]),
  ) as Font;
}
import { convertForPdfLayoutProps, hex2PrintingColor } from '@pdfme/schemas/utils';
import { PDFDict, PDFDocument as PdfLibDocument, PDFFont, PDFName, TextAlignment } from '@pdfme/pdf-lib';

let generatorModulePromise: Promise<{ generate: (...args: any[]) => Promise<any> }> | null = null;
const PDFME_GENERATOR_CDN_URL = 'https://esm.sh/@pdfme/generator@6.0.6?bundle';

function loadGeneratorModule() {
  if (!generatorModulePromise) {
    generatorModulePromise = import(/* @vite-ignore */ PDFME_GENERATOR_CDN_URL).then((module) => ({
      generate: module.generate,
    }));
  }
  return generatorModulePromise;
}

function normalizeInputs(inputs?: Record<string, string>[]) {
  return inputs && inputs.length > 0 ? inputs : [{}];
}

function toAcroFormSchema(schema: Schema, pageIndex: number): Schema {
  if ((schema as { readOnly?: boolean }).readOnly) return schema;

  if (schema.type === 'text') {
    return { ...schema, type: 'acroText', __acroRequired: schema.required, required: false } as Schema;
  }

  if (schema.type === 'checkbox') {
    return { ...schema, type: 'acroCheckbox', __acroRequired: schema.required, required: false } as Schema;
  }

  if (schema.type === 'radioGroup') {
    return {
      ...schema,
      type: 'acroRadioGroup',
      __acroPageIndex: pageIndex,
      __acroRequired: schema.required,
      required: false,
    } as Schema;
  }

  return schema;
}

function toAcroFormTemplate(template: Template): Template {
  const cloned = structuredClone(template);
  cloned.schemas = cloned.schemas.map((page, pageIndex) => page.map((schema) => toAcroFormSchema(schema, pageIndex)));
  return cloned;
}

function getFieldName(schema: Schema, cache: Map<string, unknown>) {
  const baseName = String(schema.name ?? '').trim() || 'field';
  const cacheKey = 'field-counts';
  const counts = (cache.get(cacheKey) as Map<string, number> | undefined) ?? new Map<string, number>();
  const next = (counts.get(baseName) ?? 0) + 1;
  counts.set(baseName, next);
  cache.set(cacheKey, counts);
  return next === 1 ? baseName : `${baseName}_${next}`;
}

async function getPdfFont(arg: { pdfDoc: PdfLibDocument; font: Font; fontName: string; _cache: Map<string, unknown> }) {
  const { pdfDoc, font, fontName, _cache } = arg;
  const cacheKey = `font:${fontName}`;
  const cached = _cache.get(cacheKey);
  if (cached instanceof PDFFont) return cached;

  const fontValue = font[fontName];
  if (!fontValue) throw new Error(`Font "${fontName}" is not configured`);

  const fontData =
    typeof fontValue.data === 'string' && fontValue.data.startsWith('http')
      ? await fetch(fontValue.data).then((response) => response.arrayBuffer())
      : fontValue.data;

  let pdfFont: PDFFont;
  try {
    pdfFont = await pdfDoc.embedFont(fontData, { subset: fontValue.subset ?? true });
  } catch {
    // Some fonts have cmap tables in formats unsupported by pdf-lib subsetting
    pdfFont = await pdfDoc.embedFont(fontData, { subset: false });
  }
  _cache.set(cacheKey, pdfFont);
  return pdfFont;
}

function registerAcroFormFontResource(pdfDoc: PdfLibDocument, pdfFont: PDFFont) {
  const formDict = pdfDoc.getForm().acroForm.dict;
  const context = formDict.context;
  const defaultResourcesKey = PDFName.of('DR');
  const fontResourcesKey = PDFName.of('Font');

  let defaultResources = formDict.lookupMaybe(defaultResourcesKey, PDFDict);
  if (!defaultResources) {
    defaultResources = context.obj({});
    formDict.set(defaultResourcesKey, defaultResources);
  }

  let fontResources = defaultResources.lookupMaybe(fontResourcesKey, PDFDict);
  if (!fontResources) {
    fontResources = context.obj({});
    defaultResources.set(fontResourcesKey, fontResources);
  }

  fontResources.set(PDFName.of(pdfFont.name), pdfFont.ref);
}

function getTextAlignment(alignment: 'left' | 'center' | 'right' | 'justify' | undefined) {
  switch (alignment) {
    case 'center':
      return TextAlignment.Center;
    case 'right':
      return TextAlignment.Right;
    default:
      return TextAlignment.Left;
  }
}

const acroTextPlugin = {
  pdf: async (arg: any) => {
    const { value, pdfDoc, page, options, schema, _cache } = arg;
    const font = (options.font ?? getDefaultFont()) as Font;
    const fontName = schema.fontName && font[schema.fontName] ? schema.fontName : getFallbackFontName(font);
    const pdfFont = await getPdfFont({ pdfDoc, font, fontName, _cache });
    registerAcroFormFontResource(pdfDoc, pdfFont);

    const { position, width, height, rotate } = convertForPdfLayoutProps({ schema, pageHeight: page.getHeight() });
    const textSchema = schema as {
      alignment?: 'left' | 'center' | 'right' | 'justify';
      backgroundColor?: string;
      fontColor?: string;
      fontSize?: number;
      __acroRequired?: boolean;
    };

    const textField = pdfDoc.getForm().createTextField(getFieldName(schema, _cache));
    textField.setText(value || undefined);
    textField.setAlignment(getTextAlignment(textSchema.alignment));
    textField.enableMultiline();
    if (textSchema.__acroRequired) textField.enableRequired();

    textField.addToPage(page, {
      x: position.x,
      y: position.y,
      width,
      height,
      rotate,
      font: pdfFont,
      textColor: hex2PrintingColor(textSchema.fontColor || '#000000', options.colorType),
      backgroundColor: hex2PrintingColor(textSchema.backgroundColor || '#ffffff', options.colorType),
      borderWidth: 0,
    });

    textField.setFontSize(textSchema.fontSize ?? 13);
    textField.updateAppearances(pdfFont);
  },
  ui: () => {},
  propPanel: {
    schema: {},
    defaultSchema: {
      name: '',
      type: 'acroText',
      position: { x: 0, y: 0 },
      width: 10,
      height: 10,
    },
  },
};

const acroCheckboxPlugin = {
  pdf: (arg: any) => {
    const { value, pdfDoc, page, options, schema, _cache } = arg;
    const checkboxSchema = schema as { color?: string; __acroRequired?: boolean };
    const { position, width, height, rotate } = convertForPdfLayoutProps({ schema, pageHeight: page.getHeight() });

    const checkBox = pdfDoc.getForm().createCheckBox(getFieldName(schema, _cache));
    if (value === 'true') checkBox.check();
    if (checkboxSchema.__acroRequired) checkBox.enableRequired();

    const color = checkboxSchema.color || '#000000';
    checkBox.addToPage(page, {
      x: position.x,
      y: position.y,
      width,
      height,
      rotate,
      textColor: hex2PrintingColor(color, options.colorType),
      backgroundColor: hex2PrintingColor('#ffffff', options.colorType),
      borderColor: hex2PrintingColor(color, options.colorType),
      borderWidth: 1,
    });
    checkBox.updateAppearances();
  },
  ui: () => {},
  propPanel: {
    schema: {},
    defaultSchema: {
      name: '',
      type: 'acroCheckbox',
      position: { x: 0, y: 0 },
      width: 8,
      height: 8,
    },
  },
};

const acroRadioGroupPlugin = {
  pdf: (arg: any) => {
    const { value, pdfDoc, page, options, schema } = arg;
    const radioSchema = schema as { color?: string; group?: string; __acroRequired?: boolean };
    const { position, width, height, rotate } = convertForPdfLayoutProps({ schema, pageHeight: page.getHeight() });

    const groupName = (radioSchema.group || schema.name || 'radioGroup').trim() || 'radioGroup';
    const optionName = String(schema.name || 'option').trim() || 'option';
    const radioGroup = pdfDoc.getForm().createRadioGroup(groupName);
    if (radioSchema.__acroRequired) radioGroup.enableRequired();

    radioGroup.addOptionToPage(optionName, page, {
      x: position.x,
      y: position.y,
      width,
      height,
      rotate,
      textColor: hex2PrintingColor(radioSchema.color || '#000000', options.colorType),
      backgroundColor: hex2PrintingColor('#ffffff', options.colorType),
      borderColor: hex2PrintingColor(radioSchema.color || '#000000', options.colorType),
      borderWidth: 1,
    });

    if (value === 'true') radioGroup.select(optionName);
    radioGroup.updateAppearances();
  },
  ui: () => {},
  propPanel: {
    schema: {},
    defaultSchema: {
      name: '',
      type: 'acroRadioGroup',
      position: { x: 0, y: 0 },
      width: 8,
      height: 8,
    },
  },
};

export const fillablePlugins = {
  AcroText: acroTextPlugin,
  AcroCheckbox: acroCheckboxPlugin,
  AcroRadioGroup: acroRadioGroupPlugin,
};

export async function generateFillablePdf(
  template: Template,
  inputs: Record<string, string>[],
  plugins: Record<string, unknown>,
) {
  const { generate } = await loadGeneratorModule();
  const acroTemplate = toAcroFormTemplate(template);
  return generate({
    template: acroTemplate,
    inputs: normalizeInputs(inputs),
    options: { font: getFontNoSubset(), title: 'pdfme-studio-fillable' },
    plugins: {
      ...plugins,
      ...fillablePlugins,
    },
  });
}
