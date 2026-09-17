import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { HostNoteStylePicker } from '../src/ui/host/HostNoteStylePicker';
import '../src/styles.css';
function Preview() {
const [style, setStyle] = useState('bordered');
return <main style={{maxWidth:700,margin:'20px auto',padding:12}}><div className="wizard-note-row"><div className="wizard-note-header"><h5 className="wizard-note-title">Note 1</h5><HostNoteStylePicker compact name="preview-style" theme="linen" value={style} onChange={setStyle}/></div><div className="wizard-note-body"><div className="wizard-note-photo"><p>Photograph <small>OPTIONAL</small></p><button className="photo-drop" style={{width:'100%'}}>Choose a photograph</button></div><div className="wizard-note-words"><label htmlFor="note">Your note <small>OPTIONAL</small></label><textarea id="note" rows={5} placeholder="The bench at the end of the garden gets the last of the sun. We have watched a lot of evenings go from there."/></div></div></div></main>;
}
createRoot(document.getElementById('root')).render(<Preview/>);
