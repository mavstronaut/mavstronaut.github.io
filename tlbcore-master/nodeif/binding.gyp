
{
  'targets': [
    {
      'target_name': 'ur',
      'include_dirs+': ['..','../..'],
      'includes': [
        './setup.gypi',
        '../build.src/sources_root.gypi',
        './sources.gypi',
        '../geom/sources.gypi',
      ],
      'sources': [
        './main.cc'
      ]
    }
  ]
}
