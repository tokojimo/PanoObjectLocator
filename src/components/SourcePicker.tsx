import { useRef, useState } from 'react';
import { loadBoxes, loadMetadata, loadProject } from '../data/projectIO';
import { detectDelimiter } from '../data/csv';
import { BOX_COLUMNS, META_ALIASES, META_COLUMNS, PROJECT_COLUMNS, validateColumns } from '../data/schema';
import { useStore } from '../state/store';
import { ValidationError } from '../utils/errors';

export default function SourcePicker() {
  const { state, dispatch } = useStore();
  const [directoryName, setDirectoryName] = useState<string>('');
  const [boxesName, setBoxesName] = useState<string>('');
  const [metaName, setMetaName] = useState<string>('');
  const [projectName, setProjectName] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const boxesInput = useRef<HTMLInputElement>(null);
  const metaInput = useRef<HTMLInputElement>(null);
  const projectInput = useRef<HTMLInputElement>(null);

  const pickDirectory = async () => {
    if (!('showDirectoryPicker' in window)) {
      setError('Votre navigateur ne supporte pas showDirectoryPicker.');
      return;
    }
    try {
      const dir = await (window as any).showDirectoryPicker();
      setDirectoryName(dir.name);
      dispatch({ type: 'setSources', payload: { imageDirectory: dir } });
      setError('');
    } catch (err) {
      console.error(err);
    }
  };

  const pickFileHandle = async (onPick: (handle: FileSystemFileHandle) => void) => {
    if (!('showOpenFilePicker' in window)) return false;
    const [handle] = await (window as any).showOpenFilePicker({ multiple: false });
    onPick(handle as FileSystemFileHandle);
    return true;
  };

  const handleFileInput = async (
    event: React.ChangeEvent<HTMLInputElement>,
    onPick: (file: FileSystemFileHandle | File) => void
  ) => {
    const file = event.target.files?.[0];
    if (file) onPick(file);
  };

  const handleBoxes = async () => {
    try {
      const usedFs = await pickFileHandle((handle) => {
        dispatch({ type: 'setSources', payload: { boxesHandle: handle } });
        setBoxesName(handle.name);
      });
      if (!usedFs && boxesInput.current) boxesInput.current.click();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMeta = async () => {
    try {
      const usedFs = await pickFileHandle((handle) => {
        dispatch({ type: 'setSources', payload: { metadataHandle: handle } });
        setMetaName(handle.name);
      });
      if (!usedFs && metaInput.current) metaInput.current.click();
    } catch (err) {
      console.error(err);
    }
  };

  const handleProject = async () => {
    try {
      const usedFs = await pickFileHandle((handle) => {
        dispatch({ type: 'setSources', payload: { projectHandle: handle } });
        setProjectName(handle.name);
      });
      if (!usedFs && projectInput.current) projectInput.current.click();
    } catch (err) {
      console.error(err);
    }
  };

  const validateCsv = async (
    handle: FileSystemFileHandle | File,
    expected: string[],
    aliases: Record<string, string[]> = {}
  ) => {
    const file = handle instanceof File ? handle : await handle.getFile();
    const text = await file.text();
    const [headerLine] = text.split(/\r?\n/);
    const delimiter = detectDelimiter(headerLine);
    const missing = validateColumns(headerLine.split(delimiter), expected, aliases);
    if (missing.length) throw new ValidationError(`Colonnes manquantes: ${missing.join(', ')}`);
  };

  const onLoadProject = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { boxesHandle, metadataHandle, projectHandle } = state.sources;
      const boxes = boxesHandle ?? boxesInput.current?.files?.[0];
      const meta = metadataHandle ?? metaInput.current?.files?.[0];
      const project = projectHandle ?? projectInput.current?.files?.[0];

      if (!boxes || !meta) {
        throw new ValidationError('Sélectionnez au minimum le CSV boxes et les métadonnées pano.');
      }

      await validateCsv(boxes, BOX_COLUMNS);
      await validateCsv(meta, META_COLUMNS, META_ALIASES);
      if (project) await validateCsv(project, PROJECT_COLUMNS);

      const [detections, panos, projectData] = await Promise.all([
        loadBoxes(boxes),
        loadMetadata(meta, state.sources.imageDirectory),
        project ? loadProject(project) : Promise.resolve(undefined),
      ]);

      if (projectData) {
        dispatch({
          type: 'setSources',
          payload: { projectDelimiter: projectData.delimiter, projectHandle: project as any },
        });
      }

      dispatch({
        type: 'setData',
        payload: {
          panos,
          detections,
          project: projectData,
        },
      });
      dispatch({ type: 'setStatus', payload: 'Sources chargées' });
    } catch (err) {
      if (err instanceof ValidationError) {
        setError(err.message);
      } else {
        setError('Erreur pendant le chargement des sources');
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel">
      <h2>Sources & Projet</h2>
      <p className="status">Configurez les fichiers sources avant de passer à la cartographie.</p>
      <div className="button-row" style={{ marginBottom: 8 }}>
        <button type="button" onClick={pickDirectory}>Choisir dossier d'images</button>
        {directoryName && <span className="badge">{directoryName}</span>}
      </div>
      <div className="button-row" style={{ marginBottom: 8 }}>
        <button type="button" onClick={handleBoxes}>Choisir CSV boxes</button>
        {boxesName && <span className="badge">{boxesName}</span>}
      </div>
      <div className="button-row" style={{ marginBottom: 8 }}>
        <button type="button" onClick={handleMeta}>Choisir CSV métadonnées panos</button>
        {metaName && <span className="badge">{metaName}</span>}
      </div>
      <div className="button-row" style={{ marginBottom: 8 }}>
        <button type="button" className="secondary" onClick={handleProject}>
          Choisir CSV projet existant (optionnel)
        </button>
        {projectName && <span className="badge">{projectName}</span>}
      </div>

      <input
        ref={boxesInput}
        type="file"
        accept=".csv"
        onChange={(e) =>
          handleFileInput(e, (file) => {
            dispatch({ type: 'setSources', payload: { boxesHandle: file as any } });
            setBoxesName(file.name);
          })
        }
      />
      <input
        ref={metaInput}
        type="file"
        accept=".csv"
        onChange={(e) =>
          handleFileInput(e, (file) => {
            dispatch({ type: 'setSources', payload: { metadataHandle: file as any } });
            setMetaName(file.name);
          })
        }
      />
      <input
        ref={projectInput}
        type="file"
        accept=".csv"
        onChange={(e) =>
          handleFileInput(e, (file) => {
            dispatch({ type: 'setSources', payload: { projectHandle: file as any } });
            setProjectName(file.name);
          })
        }
      />

      {error && <div className="status error">{error}</div>}
      <button type="button" disabled={loading} onClick={onLoadProject}>
        {loading ? 'Chargement…' : 'Charger le projet'}
      </button>
    </div>
  );
}
