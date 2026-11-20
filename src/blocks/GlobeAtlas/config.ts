import type { Block } from 'payload'

export const GlobeAtlas: Block = {
  slug: 'globeAtlas',
  interfaceName: 'GlobeAtlasBlock',
  labels: {
    singular: '3D Globe Atlas',
    plural: '3D Globe Atlases',
  },
  fields: [
    {
      name: 'mode',
      type: 'select',
      defaultValue: 'old_world',
      label: 'Atlas Dataset & Theme Mode',
      options: [
        { label: 'Old World & Architecture (MLB)', value: 'old_world' },
        { label: 'Declassified UAP & Disclosure Archive', value: 'uap' },
        { label: 'NDE & Past-Life Regression Archive', value: 'nde' },
      ],
      admin: {
        description: 'Choose which dataset and coordinates to render on the 3D globe.',
      },
    },
    {
      name: 'heading',
      type: 'text',
      admin: {
        description: 'Optional custom heading above the globe. Leave blank to use mode default.',
      },
    },
    {
      name: 'subheading',
      type: 'text',
      admin: {
        description: 'Optional custom subheading or mission brief.',
      },
    },
    {
      name: 'searchPlaceholder',
      type: 'text',
      admin: {
        description: 'Optional custom search input placeholder.',
      },
    },
    {
      name: 'primaryLayerLabel',
      type: 'text',
      admin: {
        description: 'Optional custom label for the primary dataset toggle button.',
      },
    },
    {
      name: 'showCityScanner',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Display the live city and historic register scanner toolbar.',
      },
    },
    {
      name: 'allowFullscreen',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Allow viewers to expand the 3D globe to full screen real estate.',
      },
    },
    {
      name: 'showAudienceMonitor',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Display the 11-platform live audience tracker (as on MLB).',
      },
    },
    {
      name: 'showExcavationHero',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Display the top illustrative hero banner.',
      },
    },
    {
      name: 'showGlobeAndRecon',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Render the interactive 3D orthographic globe and sector scanner.',
      },
    },
    {
      name: 'defaultShader',
      type: 'select',
      defaultValue: 'optical',
      options: [
        { label: 'Optical Recon', value: 'optical' },
        { label: 'FLIR / Night Optics', value: 'flir' },
        { label: 'Thermal Sensor', value: 'thermal' },
        { label: 'Architectural Blueprint', value: 'blueprint' },
      ],
    },
  ],
}
