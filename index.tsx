

import { render, html, useState, useCallback, useMemo, useEffect } from 'https://esm.sh/preact-htm-signals-standalone';
import { GoogleGenAI, Modality } from "@google/genai";
import * as pdfjsLib from 'https://esm.sh/pdfjs-dist/build/pdf.mjs';
import mammoth from 'https://esm.sh/mammoth';
import { marked } from 'https://esm.sh/marked@12.0.2';

// Required for pdf.js to work in a web worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist/build/pdf.worker.mjs';

const MARKETS = ['U.S.', 'Korea', 'France'];
const marketCombinations = [
  { source: 'U.S.', target: 'Korea' },
  { source: 'France', target: 'Korea' },
  { source: 'Korea', target: 'U.S.' },
  { source: 'Korea', target: 'France' },
];
const ASPECT_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4"];


const App = () => {
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('activeTab') || 'strategy');

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  const handleClearSession = () => {
    if (window.confirm('Are you sure you want to clear your session data? This action cannot be undone.')) {
      localStorage.clear();
      window.location.reload();
    }
  };


  const Logo = () => html`
    <div class="logo">
      <svg height="50" viewBox="0 0 260 50" xmlns="http://www.w3.org/2000/svg">
        <path d="M25 2C12.317 2 2 12.317 2 25c0 10.932 8.25 22.188 23 23 14.75-0.812 23-12.068 23-23C48 12.317 37.683 2 25 2zm0 43.75C12.125 43.625 7.25 34.875 7.25 25S12.125 6.25 25 6.25s17.75 8.75 17.75 18.75S37.875 45.75 25 45.75z" fill="#192A56"/>
        <path d="M25 9.75a15.25 15.25 0 000 30.5c4.782 0 9.1-2.204 11.91-5.748a15.25 15.25 0 01-11.91-9.502 15.25 15.25 0 01-11.91 9.502C6.208 40.25 2.89 33.155 2.89 25c0-8.155 3.318-15.25 8.2-15.25a15.25 15.25 0 0111.91 9.502A15.25 15.25 0 0136.91 9.75C34.1 7.046 29.782 9.75 25 9.75z" fill="#d62828"/>
        <path d="M25 9.75a15.25 15.25 0 010 30.5c-4.782 0-9.1-2.204-11.91-5.748a15.25 15.25 0 0011.91-9.502 15.25 15.25 0 0011.91 9.502C43.792 40.25 47.11 33.155 47.11 25c0-8.155-3.318-15.25-8.2-15.25a15.25 15.25 0 00-11.91 9.502A15.25 15.25 0 0013.09 9.75C15.9 7.046 20.218 9.75 25 9.75z" fill="#0052cc"/>
        <text x="60" y="38" font-family="Inter, sans-serif" font-weight="bold" font-size="32" fill="#192A56">lokaylize</text>
      </svg>
    </div>
  `;

  return html`
    <header>
      <${Logo} />
      <p class="tagline">Make your product local, make your message global.</p>
      <button class="clear-session-btn" onClick=${handleClearSession} title="Clear saved data">Clear Session</button>
    </header>
    <main>
        <div class="tabs">
            <button class="tab ${activeTab === 'strategy' ? 'active' : ''}" onClick=${() => setActiveTab('strategy')}>Strategy Adaptation</button>
            <button class="tab ${activeTab === 'visual' ? 'active' : ''}" onClick=${() => setActiveTab('visual')}>Visual Adaptation</button>
            <button class="tab ${activeTab === 'generation' ? 'active' : ''}" onClick=${() => setActiveTab('generation')}>Image Generation</button>
            <button class="tab ${activeTab === 'analysis' ? 'active' : ''}" onClick=${() => setActiveTab('analysis')}>Image Analysis</button>
            <button class="tab ${activeTab === 'video' ? 'active' : ''}" onClick=${() => setActiveTab('video')}>Video Analysis</button>
            <button class="tab ${activeTab === 'demos' ? 'active' : ''}" onClick=${() => setActiveTab('demos')}>Demo Cases</button>
        </div>
        <div class="tab-content">
            ${activeTab === 'strategy' && html`<${StrategyTab} />`}
            ${activeTab === 'visual' && html`<${VisualTab} />`}
            ${activeTab === 'generation' && html`<${ImageGenerationTab} />`}
            ${activeTab === 'analysis' && html`<${ImageAnalysisTab} />`}
            ${activeTab === 'video' && html`<${VideoAnalysisTab} />`}
            ${activeTab === 'demos' && html`<${DemoTab} />`}
        </div>
    </main>
    `;
};

const MarketSelector = ({ source, target, setSource, setTarget }) => {
    const handleSourceChange = (e) => {
        const newSource = e.target.value;
        setSource(newSource);
        const validTarget = marketCombinations.find(c => c.source === newSource)?.target;
        if (validTarget) {
            setTarget(validTarget);
        }
    };

    const availableTargets = useMemo(() => 
        marketCombinations.filter(c => c.source === source).map(c => c.target),
        [source]
    );

    return html`
        <div class="control-group">
            <label for="source-market">Source Market</label>
            <select id="source-market" value=${source} onChange=${handleSourceChange}>
                ${[...new Set(marketCombinations.map(c => c.source))].map(market => html`<option value=${market}>${market}</option>`)}
            </select>
        </div>
        <div class="control-group">
            <label for="target-market">Target Market</label>
            <select id="target-market" value=${target} onChange=${(e) => setTarget(e.target.value)}>
                ${availableTargets.map(market => html`<option value=${market}>${market}</option>`)}
            </select>
        </div>
    `;
};

const StrategyTab = () => {
    const [source, setSource] = useState(marketCombinations[0].source);
    const [target, setTarget] = useState(marketCombinations[0].target);
    const [text, setText] = useState('');
    const [loadingMessage, setLoadingMessage] = useState('');
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [fileName, setFileName] = useState('');
    const [history, setHistory] = useState([]);

    // Load state on mount
    useEffect(() => {
        try {
            const savedState = localStorage.getItem('strategyTabState');
            if (savedState) {
                const state = JSON.parse(savedState);
                setSource(state.source || marketCombinations[0].source);
                setTarget(state.target || marketCombinations[0].target);
                setText(state.text || '');
                setResult(state.result || null);
                setFileName(state.fileName || '');
                setHistory(state.history || []);
            }
        } catch (e) {
            console.error("Failed to load strategy state from localStorage", e);
        }
    }, []);

    // Save state on change
    useEffect(() => {
        try {
            const stateToSave = { source, target, text, result, fileName, history };
            localStorage.setItem('strategyTabState', JSON.stringify(stateToSave));
        } catch (e) {
            console.error("Failed to save strategy state to localStorage", e);
        }
    }, [source, target, text, result, fileName, history]);

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setLoadingMessage(`Parsing ${file.name}...`);
        setError('');
        setText('');
        setResult(null);
        setFileName(file.name);

        try {
            let extractedText = '';
            const fileType = file.type;
            const extension = file.name.split('.').pop().toLowerCase();

            if (fileType === 'application/pdf' || extension === 'pdf') {
                extractedText = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = async (event) => {
                        try {
                            if (!event.target?.result) {
                                return reject(new Error('File content is empty.'));
                            }
                            const pdf = await pdfjsLib.getDocument({ data: event.target.result }).promise;
                            let content = '';
                            for (let i = 1; i <= pdf.numPages; i++) {
                                const page = await pdf.getPage(i);
                                const textContent = await page.getTextContent();
                                content += textContent.items.map(item => item.str).join(' ');
                            }
                            resolve(content);
                        } catch (err) {
                            reject(new Error('Failed to parse PDF file.'));
                        }
                    };
                    reader.onerror = () => reject(new Error('Failed to read file.'));
                    reader.readAsArrayBuffer(file);
                });
            } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || extension === 'docx') {
                extractedText = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = async (event) => {
                        try {
                            if (!event.target?.result) {
                                return reject(new Error('File content is empty.'));
                            }
                            const { value } = await mammoth.extractRawText({ arrayBuffer: event.target.result });
                            resolve(value);
                        } catch (err) {
                            reject(new Error('Failed to parse DOCX file.'));
                        }
                    };
                    reader.onerror = () => reject(new Error('Failed to read file.'));
                    reader.readAsArrayBuffer(file);
                });
            } else if (fileType === 'text/plain' || extension === 'txt') {
                 extractedText = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        if (typeof event.target?.result === 'string') {
                           resolve(event.target.result);
                        } else {
                           reject(new Error('Failed to read text file.'));
                        }
                    };
                    reader.onerror = () => reject(new Error('Failed to read file.'));
                    reader.readAsText(file);
                });
            } else {
                throw new Error('Unsupported file type. Please upload a PDF, DOCX, or TXT file.');
            }
            setText(extractedText);
        } catch (err) {
            console.error('File Processing Error:', err);
            setError(err.message || 'An error occurred while processing the file.');
            setFileName('');
        } finally {
            setLoadingMessage('');
        }
    };


    const handleSubmit = async () => {
        if (!text) return;
        setLoadingMessage('Analyzing and adapting strategy... this may take a moment.');
        setResult(null);
        setError('');
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `Act as an expert marketing localization consultant. Analyze the following marketing strategy document and adapt it for the ${target} market, considering it comes from a ${source} context. 
            
            Focus on adapting:
            - Brand positioning and messaging tone.
            - SEO keywords and relevant local search engines/platforms.
            - Social media tactics and popular local channels.
            - Distribution channels and consumer purchasing habits.
            - Cultural nuances, values, and potential compliance issues.

            Provide a new, culturally adapted marketing strategy. Format the output in Markdown.

            Original Document Text:
            ---
            ${text}
            ---
            `;
            const response = await ai.models.generateContent({
              model: 'gemini-2.5-pro',
              contents: prompt,
            });
            
            const summaryPrompt = `Briefly summarize the key points of this marketing document in a few bullet points: \n\n${text}`;
            const summaryResponse = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: summaryPrompt
            });
            
            const newResult = {
              before: summaryResponse.text,
              after: response.text,
            };
            setResult(newResult);
            
            // Add to history
            const newHistoryEntry = {
                id: Date.now(),
                source,
                target,
                text,
                fileName,
                result: newResult
            };
            setHistory(prev => [newHistoryEntry, ...prev]);

        } catch (err) {
            console.error(err);
            setError('Failed to generate strategy. Please try again.');
        } finally {
            setLoadingMessage('');
        }
    };
    
    const handleRestore = (item) => {
        setSource(item.source);
        setTarget(item.target);
        setText(item.text);
        setFileName(item.fileName);
        setResult(item.result);
        setError('');
        window.scrollTo(0, 0);
    };

    return html`
        <h2>Adapt Marketing Strategy Documents</h2>
        <p>Upload your strategy document (PDF, DOCX, TXT) or paste the text directly below.</p>
        <div class="controls">
            <${MarketSelector} source=${source} target=${target} setSource=${setSource} setTarget=${setTarget} />
        </div>
        
        <div class="input-options">
            <div class="control-group">
                <label for="strategy-upload">Upload Document</label>
                <input type="file" id="strategy-upload" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange=${handleFileChange} disabled=${!!loadingMessage} />
                 ${fileName && html`<span class="file-name">Loaded: ${fileName}</span>`}
            </div>
            <div class="or-divider">OR</div>
            <div class="control-group" style="flex-grow: 1;">
                <label for="strategy-text">Paste Text</label>
                <textarea id="strategy-text" placeholder="Paste text here or upload a file..." value=${text} onInput=${(e) => {
                    setText(e.target.value);
                    if (fileName) setFileName('');
                }} disabled=${!!loadingMessage}></textarea>
            </div>
        </div>

        <button onClick=${handleSubmit} disabled=${!!loadingMessage || !text}>
            ${loadingMessage ? 'Processing...' : 'Localize Strategy'}
        </button>
        
        ${loadingMessage && html`
            <div class="loader">
                <div class="spinner"></div>
                <span>${loadingMessage}</span>
            </div>
        `}
        ${error && html`<p class="error-message">${error}</p>`}

        ${result && html`
            <div class="results">
                <div class="result-panel">
                    <h3>Original Key Points</h3>
                    <div class="markdown" dangerouslySetInnerHTML=${{ __html: marked(result.before) }}></div>
                </div>
                <div class="result-panel">
                    <h3>Adapted Strategy for ${target}</h3>
                    <div class="markdown" dangerouslySetInnerHTML=${{ __html: marked(result.after) }}></div>
                </div>
            </div>
        `}
        
        ${history.length > 0 && html`
            <div class="history-section">
                <h3>History</h3>
                <div class="history-grid">
                    ${history.map(item => html`
                        <div class="history-item" onClick=${() => handleRestore(item)}>
                            <p>${item.source} → ${item.target}</p>
                            <span>${item.fileName || 'Pasted Text'}</span>
                        </div>
                    `)}
                </div>
            </div>
        `}
    `;
};

const VisualTab = () => {
    const [source, setSource] = useState(marketCombinations[0].source);
    const [target, setTarget] = useState(marketCombinations[0].target);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [imageModel, setImageModel] = useState('gemini-2.5-flash-image');
    const [aspectRatio, setAspectRatio] = useState(ASPECT_RATIOS[0]);
    const [history, setHistory] = useState([]);

    // Load state on mount
    useEffect(() => {
        try {
            const savedState = localStorage.getItem('visualTabState');
            if (savedState) {
                const state = JSON.parse(savedState);
                setSource(state.source || marketCombinations[0].source);
                setTarget(state.target || marketCombinations[0].target);
                setImagePreview(state.imagePreview || '');
                setResult(state.result || null);
                setImageModel(state.imageModel || 'gemini-2.5-flash-image');
                setAspectRatio(state.aspectRatio || ASPECT_RATIOS[0]);
                setHistory(state.history || []);
            }
        } catch (e) {
            console.error("Failed to load visual state from localStorage", e);
        }
    }, []);

    // Save state on change
    useEffect(() => {
        try {
            // Do not save imageFile
            const stateToSave = { source, target, imagePreview, result, imageModel, aspectRatio, history };
            localStorage.setItem('visualTabState', JSON.stringify(stateToSave));
        } catch (e) {
            console.error("Failed to save visual state to localStorage", e);
        }
    }, [source, target, imagePreview, result, imageModel, aspectRatio, history]);


    const fileToGenerativePart = async (file: File) => {
        const base64EncodedDataPromise = new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (typeof reader.result === 'string') {
                    resolve(reader.result.split(',')[1]);
                } else {
                    reject(new Error("File could not be read as a string."));
                }
            };
            reader.onerror = (error) => reject(error);
            reader.readAsDataURL(file);
        });
        return {
            inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
        };
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
            setResult(null);
            setError('');
            
            const reader = new FileReader();
            reader.onloadend = () => {
                if (typeof reader.result === 'string') {
                    setImagePreview(reader.result);
                }
            };
            reader.readAsDataURL(file);
        }
    };
    
    const handleRestore = (item) => {
        setSource(item.source);
        setTarget(item.target);
        setImageModel(item.imageModel);
        setAspectRatio(item.aspectRatio || ASPECT_RATIOS[0]);
        setImagePreview(item.imagePreview);
        setResult(item.result);
        setImageFile(null); // Can't restore file object, but we have the preview
        setError('');
        window.scrollTo(0, 0);
    };

    const handleSubmit = async () => {
        if (!imageFile && !imagePreview) return; // Allow resubmitting from preview
        setLoading(true);
        setResult(null);
        setError('');

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            // If we have a file, use it. Otherwise, use the preview data (for resubmission).
            const imagePart = imageFile 
                ? await fileToGenerativePart(imageFile)
                : { 
                    inlineData: { 
                        data: imagePreview.split(',')[1], 
                        mimeType: imagePreview.match(/:(.*?);/)[1] 
                    } 
                  };

            // 1. Cultural Audit
            const auditPrompt = `You are a cultural marketing expert. Analyze this visual material from a ${source} context for a ${target} audience. 
            Provide a cultural audit covering:
            - Colors and symbolism.
            - Font choices and typography.
            - Composition and layout norms.
            - Overall tone and message.
            - Any text present and its cultural appropriateness.
            - Key recommendations for adaptation.
            Format as a concise bulleted list.`;

            const auditResponse = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: { parts: [imagePart, { text: auditPrompt }] }
            });
            const auditText = auditResponse.text;
            let newImageData = '';

            if (imageModel === 'gemini-2.5-flash-image') {
                 // 2. Image Regeneration
                const regenPrompt = `Based on this cultural audit, regenerate the provided image to be suitable for a ${target} audience. Apply the recommendations.
                Ensure any text is legible, culturally appropriate for ${target}, and well-integrated.
                
                Audit & Recommendations:
                ${auditText}`;

                const regenResponse = await ai.models.generateContent({
                    model: 'gemini-2.5-flash-image',
                    contents: { parts: [imagePart, { text: regenPrompt }] },
                    config: { responseModalities: [Modality.IMAGE] },
                });
                
                if (regenResponse.candidates?.[0]?.content?.parts) {
                    for (const part of regenResponse.candidates[0].content.parts) {
                        if (part.inlineData) {
                            newImageData = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                            break;
                        }
                    }
                }
            } else if (imageModel === 'imagen-4.0-generate-001') {
                // 2a. Describe the original image
                const describePrompt = "You are an expert prompt engineer. Describe the following image in detail. Focus on subjects, composition, style, colors, and atmosphere. This description will be used to generate a new image from scratch.";
                const describeResponse = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: { parts: [imagePart, { text: describePrompt }] }
                });
                const imageDescription = describeResponse.text;

                // 2b. Create new prompt for Imagen
                const imagenPrompt = `Create a new, photorealistic marketing image adapted for a ${target} audience, based on the cultural audit below.
                
                Original Image Description (for context, do not copy verbatim):
                ---
                ${imageDescription}
                ---
                
                Cultural Audit & Adaptation Recommendations:
                ---
                ${auditText}
                ---

                Your task is to generate a new visual that captures the essence of the original but is fully localized according to the recommendations.`;

                // 2c. Call generateImages
                const regenResponse = await ai.models.generateImages({
                    model: 'imagen-4.0-generate-001',
                    prompt: imagenPrompt,
                    config: {
                        numberOfImages: 1,
                        outputMimeType: 'image/jpeg',
                        aspectRatio: aspectRatio,
                    },
                });

                if (regenResponse.generatedImages && regenResponse.generatedImages.length > 0) {
                    const base64ImageBytes = regenResponse.generatedImages[0].image.imageBytes;
                    newImageData = `data:image/jpeg;base64,${base64ImageBytes}`;
                }
            }
            
            if (!newImageData) throw new Error("Image generation failed or returned no image data.");

            const newResult = {
                audit: auditText,
                newImage: newImageData,
            };
            setResult(newResult);
            
             // Add to history
            const newHistoryEntry = {
                id: Date.now(),
                source,
                target,
                imageModel,
                aspectRatio,
                imagePreview, // this is already base64
                result: newResult
            };
            setHistory(prev => [newHistoryEntry, ...prev]);

        } catch (err) {
            console.error(err);
            setError('Failed to adapt visual. Please try a different image.');
        } finally {
            setLoading(false);
        }
    };


    return html`
        <h2>Adapt Visual Materials</h2>
        <p>Upload your campaign visual (poster, social media image) for a full cultural audit and AI-powered adaptation.</p>
        <div class="controls">
            <${MarketSelector} source=${source} target=${target} setSource=${setSource} setTarget=${setTarget} />
            <div class="control-group">
                <label for="image-model-select">Generation Model</label>
                <select id="image-model-select" value=${imageModel} onChange=${e => setImageModel(e.target.value)}>
                    <option value="gemini-2.5-flash-image">Adapt (Edit Existing Visual)</option>
                    <option value="imagen-4.0-generate-001">Re-imagine (Generate New Visual)</option>
                </select>
            </div>
             ${imageModel === 'imagen-4.0-generate-001' && html`
                <div class="control-group">
                    <label for="visual-aspect-ratio-select">Aspect Ratio</label>
                    <select id="visual-aspect-ratio-select" value=${aspectRatio} onChange=${e => setAspectRatio(e.target.value)}>
                        ${ASPECT_RATIOS.map(ratio => html`<option value=${ratio}>${ratio}</option>`)}
                    </select>
                </div>
            `}
            <div class="control-group">
                <label for="visual-upload">Upload Image (PNG, JPG)</label>
                <input type="file" id="visual-upload" accept="image/png, image/jpeg" onChange=${handleFileChange} />
            </div>
            <button onClick=${handleSubmit} disabled=${loading || (!imageFile && !imagePreview)}>
                ${loading ? 'Adapting...' : 'Localize Visual'}
            </button>
        </div>

        ${loading && html`
            <div class="loader">
                <div class="spinner"></div>
                <span>Performing cultural audit and generating new visual...</span>
            </div>
        `}
        ${error && html`<p class="error-message">${error}</p>`}

        <div class="results">
            <div class="result-panel">
                <h3>Original Visual</h3>
                ${imagePreview ? html`<img src=${imagePreview} alt="Original visual preview" />` : html`<p>Your original visual will be displayed here.</p>`}
                ${result?.audit && html`
                    <h4>Cultural Audit</h4>
                    <div class="markdown" dangerouslySetInnerHTML=${{ __html: marked(result.audit) }}></div>
                `}
            </div>
            <div class="result-panel">
                <h3>Adapted Visual for ${target}</h3>
                ${result?.newImage && html`<img src=${result.newImage} alt="Adapted visual generated by AI" />`}
                ${!result?.newImage && !loading && html`<p>Your new, localized visual will appear here after analysis.</p>`}
            </div>
        </div>
        
        ${history.length > 0 && html`
            <div class="history-section">
                <h3>History</h3>
                <div class="history-grid">
                    ${history.map(item => html`
                        <div class="history-item" onClick=${() => handleRestore(item)}>
                            <p>${item.source} → ${item.target}</p>
                            <span>Model: ${item.imageModel === 'imagen-4.0-generate-001' ? 'Re-imagine' : 'Adapt'}</span>
                            <div class="history-thumbnails">
                                <img src=${item.imagePreview} class="history-thumbnail" alt="Original" />
                                <img src=${item.result.newImage} class="history-thumbnail" alt="Adapted" />
                            </div>
                        </div>
                    `)}
                </div>
            </div>
        `}
    `;
};

const ImageGenerationTab = () => {
    const [prompt, setPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState(ASPECT_RATIOS[0]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [generatedImage, setGeneratedImage] = useState('');

     // Load state on mount
    useEffect(() => {
        try {
            const savedState = localStorage.getItem('generationTabState');
            if (savedState) {
                const state = JSON.parse(savedState);
                setPrompt(state.prompt || '');
                setAspectRatio(state.aspectRatio || ASPECT_RATIOS[0]);
                setGeneratedImage(state.generatedImage || '');
            }
        } catch (e) {
            console.error("Failed to load generation state from localStorage", e);
        }
    }, []);

    // Save state on change
    useEffect(() => {
        try {
            const stateToSave = { prompt, aspectRatio, generatedImage };
            localStorage.setItem('generationTabState', JSON.stringify(stateToSave));
        } catch (e) {
            console.error("Failed to save generation state to localStorage", e);
        }
    }, [prompt, aspectRatio, generatedImage]);

    const handleSubmit = async () => {
        if (!prompt) return;
        setLoading(true);
        setError('');
        setGeneratedImage('');
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateImages({
                model: 'imagen-4.0-generate-001',
                prompt: prompt,
                config: {
                    numberOfImages: 1,
                    outputMimeType: 'image/jpeg',
                    aspectRatio: aspectRatio,
                },
            });

            if (response.generatedImages && response.generatedImages.length > 0) {
                const base64ImageBytes = response.generatedImages[0].image.imageBytes;
                setGeneratedImage(`data:image/jpeg;base64,${base64ImageBytes}`);
            } else {
                throw new Error("Image generation failed to return an image.");
            }
        } catch (err) {
            console.error(err);
            setError('Failed to generate image. Please check your prompt and try again.');
        } finally {
            setLoading(false);
        }
    };

    return html`
        <h2>Generate Images with Imagen</h2>
        <p>Describe the image you want to create. Be as detailed as possible for the best results.</p>
        <div class="controls" style="align-items: flex-start;">
             <div class="control-group" style="flex-grow: 1;">
                <label for="generation-prompt">Prompt</label>
                <textarea id="generation-prompt" placeholder="e.g., A photorealistic image of a blue robot holding a red skateboard in a futuristic city" value=${prompt} onInput=${(e) => setPrompt(e.target.value)} disabled=${loading}></textarea>
            </div>
        </div>
        <div class="controls">
            <div class="control-group">
                <label for="aspect-ratio-select">Aspect Ratio</label>
                <select id="aspect-ratio-select" value=${aspectRatio} onChange=${e => setAspectRatio(e.target.value)} disabled=${loading}>
                    ${ASPECT_RATIOS.map(ratio => html`<option value=${ratio}>${ratio}</option>`)}
                </select>
            </div>
            <button onClick=${handleSubmit} disabled=${loading || !prompt}>
                ${loading ? 'Generating...' : 'Generate Image'}
            </button>
        </div>

        ${loading && html`
            <div class="loader">
                <div class="spinner"></div>
                <span>Generating your image... this can take a moment.</span>
            </div>
        `}
        ${error && html`<p class="error-message">${error}</p>`}

        ${generatedImage && html`
            <div class="results" style="grid-template-columns: 1fr; justify-items: center;">
                 <div class="result-panel" style="max-width: 800px;">
                    <h3>Generated Image</h3>
                    <img src=${generatedImage} alt="AI generated image" />
                </div>
            </div>
        `}
    `;
};


const ImageAnalysisTab = () => {
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState('');
    const [loading, setLoading] = useState(false);
    const [analysisResult, setAnalysisResult] = useState('');
    const [error, setError] = useState('');

    // Load state on mount
    useEffect(() => {
        try {
            const savedState = localStorage.getItem('analysisTabState');
            if (savedState) {
                const state = JSON.parse(savedState);
                setImagePreview(state.imagePreview || '');
                setAnalysisResult(state.analysisResult || '');
            }
        } catch (e) {
            console.error("Failed to load analysis state from localStorage", e);
        }
    }, []);

    // Save state on change
    useEffect(() => {
        try {
            // Do not save imageFile
            const stateToSave = { imagePreview, analysisResult };
            localStorage.setItem('analysisTabState', JSON.stringify(stateToSave));
        } catch (e) {
            console.error("Failed to save analysis state to localStorage", e);
        }
    }, [imagePreview, analysisResult]);

    const fileToGenerativePart = async (file: File) => {
        const base64EncodedDataPromise = new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (typeof reader.result === 'string') {
                    resolve(reader.result.split(',')[1]);
                } else {
                    reject(new Error("File could not be read as a string."));
                }
            };
            reader.onerror = (error) => reject(error);
            reader.readAsDataURL(file);
        });
        return {
            inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
        };
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
            setAnalysisResult('');
            setError('');
            
            const reader = new FileReader();
            reader.onloadend = () => {
                if (typeof reader.result === 'string') {
                    setImagePreview(reader.result);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async () => {
        if (!imageFile && !imagePreview) return; // Allow resubmitting from preview
        setLoading(true);
        setAnalysisResult('');
        setError('');

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            const imagePart = imageFile 
                ? await fileToGenerativePart(imageFile)
                : { 
                    inlineData: { 
                        data: imagePreview.split(',')[1], 
                        mimeType: imagePreview.match(/:(.*?);/)[1] 
                    } 
                  };

            const prompt = "Analyze this image in detail. Describe the objects, people, setting, colors, and any potential context or meaning.";

            const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: { parts: [imagePart, { text: prompt }] }
            });

            setAnalysisResult(response.text);

        } catch (err) {
            console.error(err);
            setError('Failed to analyze the image. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return html`
        <h2>Analyze Image with Gemini</h2>
        <p>Upload an image (PNG, JPG) to get a detailed analysis from the Gemini model.</p>
        <div class="controls">
            <div class="control-group">
                <label for="analysis-upload">Upload Image</label>
                <input type="file" id="analysis-upload" accept="image/png, image/jpeg" onChange=${handleFileChange} />
            </div>
            <button onClick=${handleSubmit} disabled=${loading || (!imageFile && !imagePreview)}>
                ${loading ? 'Analyzing...' : 'Analyze Image'}
            </button>
        </div>

        ${loading && html`
            <div class="loader">
                <div class="spinner"></div>
                <span>Analyzing your image...</span>
            </div>
        `}
        ${error && html`<p class="error-message">${error}</p>`}

        ${(imagePreview || analysisResult) && html`
            <div class="results">
                <div class="result-panel">
                    <h3>Uploaded Image</h3>
                    ${imagePreview ? html`<img src=${imagePreview} alt="Uploaded image preview" />` : html`<p>Your image will be displayed here.</p>`}
                </div>
                <div class="result-panel">
                    <h3>Analysis</h3>
                    ${analysisResult ? html`<div class="markdown" dangerouslySetInnerHTML=${{ __html: marked(analysisResult) }}></div>` : ''}
                    ${!analysisResult && !loading && html`<p>The analysis from Gemini will appear here.</p>`}
                </div>
            </div>
        `}
    `;
};

const VideoAnalysisTab = () => {
    const [source, setSource] = useState(marketCombinations[0].source);
    const [target, setTarget] = useState(marketCombinations[0].target);
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [videoPreviewUrl, setVideoPreviewUrl] = useState('');
    const [loadingMessage, setLoadingMessage] = useState('');
    const [analysisResult, setAnalysisResult] = useState('');
    const [error, setError] = useState('');
    const [progress, setProgress] = useState(0);

    // Load state on mount
    useEffect(() => {
        try {
            const savedState = localStorage.getItem('videoAnalysisTabState');
            if (savedState) {
                const state = JSON.parse(savedState);
                setSource(state.source || marketCombinations[0].source);
                setTarget(state.target || marketCombinations[0].target);
                setAnalysisResult(state.analysisResult || '');
                // Do not restore video file or preview URL as it's temporary
            }
        } catch (e) {
            console.error("Failed to load video analysis state from localStorage", e);
        }
    }, []);

    // Save state on change
    useEffect(() => {
        try {
            const stateToSave = { source, target, analysisResult };
            localStorage.setItem('videoAnalysisTabState', JSON.stringify(stateToSave));
        } catch (e) {
            console.error("Failed to save video analysis state to localStorage", e);
        }
    }, [source, target, analysisResult]);

    // Cleanup Object URL when component unmounts or URL changes
    useEffect(() => {
        return () => {
            if (videoPreviewUrl) {
                URL.revokeObjectURL(videoPreviewUrl);
            }
        };
    }, [videoPreviewUrl]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (videoPreviewUrl) {
                URL.revokeObjectURL(videoPreviewUrl); // Revoke old URL
            }
            setVideoFile(file);
            setAnalysisResult('');
            setError('');
            setProgress(0);
            
            const url = URL.createObjectURL(file);
            setVideoPreviewUrl(url);
        }
    };

    const extractFrames = async (file: File, fps = 1, maxFrames = 30): Promise<any[]> => {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const frames: any[] = [];

            video.src = URL.createObjectURL(file);
            video.muted = true;

            video.onloadedmetadata = () => {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                
                const duration = video.duration;
                const interval = 1 / fps;
                const totalFramesToExtract = Math.min(Math.floor(duration * fps), maxFrames);
                let currentTime = 0;
                let framesExtracted = 0;
                
                if(totalFramesToExtract === 0) {
                    URL.revokeObjectURL(video.src);
                    return reject(new Error("Video is too short to extract frames or has zero duration."));
                }

                video.onseeked = async () => {
                    if (!ctx) return reject(new Error("Canvas context not available"));
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    
                    const base64Data = canvas.toDataURL('image/jpeg').split(',')[1];
                    frames.push({
                        inlineData: { data: base64Data, mimeType: 'image/jpeg' },
                    });
                    
                    framesExtracted++;
                    setProgress(Math.round((framesExtracted / totalFramesToExtract) * 100));

                    if (framesExtracted >= totalFramesToExtract) {
                        URL.revokeObjectURL(video.src);
                        resolve(frames);
                    } else {
                        currentTime += interval;
                        if (currentTime <= duration) {
                            video.currentTime = currentTime;
                        } else {
                             URL.revokeObjectURL(video.src);
                             resolve(frames);
                        }
                    }
                };
                
                video.onerror = (err) => {
                     URL.revokeObjectURL(video.src);
                     reject(new Error("Failed to load video file for frame extraction. It may be corrupt or in an unsupported format."));
                };

                // Start the process
                video.currentTime = 0.01; // Seeking to 0 can be problematic, start just after
            };
        });
    };

    const handleSubmit = async () => {
        if (!videoFile) return;
        setLoadingMessage('Extracting frames from video...');
        setAnalysisResult('');
        setError('');
        setProgress(0);

        try {
            const frames = await extractFrames(videoFile);
            if (!frames || frames.length === 0) {
              throw new Error("Could not extract any frames from the video.");
            }

            setLoadingMessage('Analyzing video with Gemini...');
            setProgress(0); // Reset progress for analysis phase
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            const prompt = `Act as an expert marketing localization consultant. Analyze the following video frames from a marketing clip. The original context is ${source} and it needs to be adapted for the ${target} market.

            Provide a detailed analysis and a set of actionable recommendations. Focus on:
            - **Cultural Appropriateness:** Are there any symbols, gestures, or scenarios that might be misinterpreted or offensive in the ${target} market?
            - **Visuals & Aesthetics:** Analyze colors, pacing, editing style, and overall visual tone. How does it align with ${target}'s preferences?
            - **Casting & Representation:** Do the people shown resonate with the ${target} audience?
            - **Messaging & Storytelling:** Is the core message clear and compelling for ${target}?
            - **Actionable Recommendations:** Provide a clear, bulleted list of specific changes to make the video more effective in ${target}.

            Format the entire output in Markdown.`;
            
            const contents = [{ text: prompt }, ...frames];

            const response = await ai.models.generateContent({
              model: 'gemini-2.5-pro',
              contents: { parts: contents },
            });

            setAnalysisResult(response.text);

        } catch (err) {
            console.error(err);
            setError(err.message || 'Failed to analyze the video. Please try again.');
        } finally {
            setLoadingMessage('');
            setProgress(0);
        }
    };

    return html`
        <h2>Analyze Video for Market Adaptation</h2>
        <p>Upload a short video clip (e.g., advertisement, social media video) to get an AI-powered cultural analysis and adaptation strategy using Gemini 2.5 Pro.</p>
        <div class="controls">
            <${MarketSelector} source=${source} target=${target} setSource=${setSource} setTarget=${setTarget} />
            <div class="control-group">
                <label for="video-upload">Upload Video (MP4, MOV, WebM)</label>
                <input type="file" id="video-upload" accept="video/mp4,video/quicktime,video/webm" onChange=${handleFileChange} disabled=${!!loadingMessage} />
            </div>
            <button onClick=${handleSubmit} disabled=${!!loadingMessage || !videoFile}>
                ${loadingMessage ? 'Processing...' : 'Analyze Video'}
            </button>
        </div>

        ${loadingMessage && html`
            <div class="loader">
                <div class="spinner"></div>
                <span>${loadingMessage}</span>
            </div>
            ${loadingMessage.startsWith('Extracting') && progress > 0 && html`
                 <div class="progress-bar-container">
                    <div class="progress-bar" style="width: ${progress}%"></div>
                 </div>
            `}
        `}
        ${error && html`<p class="error-message">${error}</p>`}

        ${(videoPreviewUrl || analysisResult) && !loadingMessage && html`
            <div class="results">
                <div class="result-panel">
                    <h3>Uploaded Video</h3>
                    ${videoPreviewUrl ? html`<video src=${videoPreviewUrl} controls muted playsinline style="width: 100%; border-radius: 4px; max-height: 400px;" />` : html`<p>Your video will be displayed here.</p>`}
                </div>
                <div class="result-panel">
                    <h3>Adaptation Analysis for ${target}</h3>
                    ${analysisResult ? html`<div class="markdown" dangerouslySetInnerHTML=${{ __html: marked(analysisResult) }}></div>` : ''}
                    ${!analysisResult && !loadingMessage && html`<p>The analysis and recommendations from Gemini will appear here.</p>`}
                </div>
            </div>
        `}
    `;
};


const DemoTab = () => html`
    <h2>Showcasing Real-World Localization</h2>
    <p>These demo cases illustrate how Lokaylize adapts strategies for market success.</p>
    
    <div class="demo-case">
        <h3>Case 1: iHerb's Market Entry (U.S. → Korea)</h3>
        <div class="results">
            <div class="result-panel">
                <h4>Before: U.S. Strategy</h4>
                <ul>
                    <li><strong>Target Persona:</strong> Health-conscious millennial, values organic, reads blogs for reviews.</li>
                    <li><strong>Channels:</strong> Google SEO, Facebook Ads, Email Marketing.</li>
                    <li><strong>Messaging:</strong> Focus on "clean ingredients" and "wellness lifestyle."</li>
                </ul>
            </div>
            <div class="result-panel">
                <h4>After: Adapted Korean Strategy</h4>
                <ul>
                    <li><strong>Target Persona:</strong> Mobile-first "digital deal-seeker," trusts user reviews on Naver, follows influencers on Instagram.</li>
                    <li><strong>Channels:</strong> Naver SEO, KakaoTalk promotions, Instagram influencer partnerships.</li>
                    <li><strong>Messaging:</strong> Emphasize "fast delivery," "great value," and show product hauls and unboxings.</li>
                </ul>
            </div>
        </div>
    </div>

    <div class="demo-case">
        <h3>Case 2: d'Alba Piedmont's Credibility (Korea → Europe)</h3>
        <div class="results">
            <div class="result-panel">
                <h4>Before: Korean Strategy</h4>
                <ul>
                    <li><strong>Credibility:</strong> Assumed brand recognition in the competitive K-Beauty space.</li>
                    <li><strong>Channels:</strong> Heavy reliance on Olive Young (local drug store) placement and Naver blogs.</li>
                    <li><strong>Visuals:</strong> Focus on flawless, "glass skin" aesthetic with Korean models.</li>
                </ul>
            </div>
            <div class="result-panel">
                <h4>After: Adapted European Strategy</h4>
                <ul>
                    <li><strong>Credibility:</strong> Build trust from scratch. Focus on "dermatologically tested" and "scientifically proven" claims.</li>
                    <li><strong>Channels:</strong> Influencer-led campaigns across France, Germany, Spain, UK. Partner with reputable beauty e-tailers.</li>
                    <li><strong>Visuals:</strong> Showcase a diverse range of European models, emphasizing natural skin radiance over perfection.</li>
                </ul>
            </div>
        </div>
    </div>
`;


render(html`<${App} />`, document.getElementById('root'));