// Налаштування Supabase. Заповніть двома значеннями з Supabase: Project Settings → API.
// Це ті самі URL та anon key, що й у Rivna app (anon key публічний за задумом).
// НІКОЛИ не вставляйте сюди service_role key.
// Якщо залишити порожнім, Ducky працює локально: акаунт і дані лише в цьому браузері.
window.DUCKY_CONFIG = {
  supabaseUrl: 'https://yvwqitbyjpqdocugjgvj.supabase.co',
  supabaseAnonKey: '',
};
