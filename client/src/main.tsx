import { createRoot } from 'react-dom/client';
import '@fontsource/andika/400.css';
import '@fontsource/andika/700.css';
import '@fontsource/playwrite-fr-trad/400.css';
import '@fontsource-variable/fredoka';
import './styles.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(<App />);
