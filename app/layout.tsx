import './globals.css';
import type {Metadata} from 'next';
export const metadata:Metadata={title:'MixMade — Everyone brings the music.',description:'Collaborative playlist rooms with duplicate detection, similarity suggestions, and MP3 uploads.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
