export default {
  label: 'preferences.keymap.name',
  field: 'keymap',

  children: {
    profiles: {
      label: 'preferences.keymap.profiles.name',
      field: 'profiles',
      type: 'KeymapProfileList',
      value: [],
      span: 24,
    },
    activeProfile: {
      label: 'preferences.keymap.activeProfile.name',
      field: 'activeProfile',
      type: 'Select',
      value: '',
      placeholder: 'preferences.keymap.activeProfile.placeholder',
      options: [],
    },
  },
}
