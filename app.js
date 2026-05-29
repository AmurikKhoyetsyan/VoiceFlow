/* VOICEFLOW - COMPREHENSIVE APPLICATION ENGINE */

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide Icons
    lucide.createIcons();

    // ==========================================
    // DOM ELEMENTS SELECTORS
    // ==========================================
    const themeToggle = document.getElementById('theme-toggle');
    const textInput = document.getElementById('text-input');
    const textBackdrop = document.getElementById('text-backdrop');
    
    // Stats
    const charCount = document.getElementById('char-count');
    const wordCount = document.getElementById('word-count');
    const timeEstimate = document.getElementById('time-estimate');
    
    // Actions
    const btnClear = document.getElementById('btn-clear');
    const btnPaste = document.getElementById('btn-paste');
    const btnPlay = document.getElementById('btn-play');
    const btnStop = document.getElementById('btn-stop');
    const btnBookmark = document.getElementById('btn-bookmark');
    
    // Controls
    const voiceSelect = document.getElementById('voice-select');
    const rateSlider = document.getElementById('rate-slider');
    const rateValue = document.getElementById('rate-value');
    const pitchSlider = document.getElementById('pitch-slider');
    const pitchValue = document.getElementById('pitch-value');
    const volumeSlider = document.getElementById('volume-slider');
    const volumeValue = document.getElementById('volume-value');
    
    // Bookmarks
    const bookmarksList = document.getElementById('bookmarks-list');
    const bookmarksEmpty = document.getElementById('bookmarks-empty');
    const bookmarkCountBadge = document.getElementById('bookmark-count');
    
    // Visualizer Canvas
    const canvas = document.getElementById('waveform-canvas');
    const ctx = canvas.getContext('2d');
    const visualizerStatusIndicator = document.querySelector('.status-indicator');
    const visualizerStatusText = document.querySelector('.status-text');
    
    // Toast Container
    const toastContainer = document.getElementById('toast-container');

    // ==========================================
    // STATE VARIABLES
    // ==========================================
    let synth = window.speechSynthesis;
    let voices = [];
    let currentUtterance = null;
    let isSpeaking = false;
    let isPaused = false;
    let currentWordIndex = -1;
    let currentWordLength = 0;
    
    // Waveform Animation State
    let animationId = null;
    let waveOffset = 0;
    let waveTargetAmplitude = 0;
    let waveCurrentAmplitude = 0;

    // Default template text
    const templates = {
        greeting: "Привет! Добро пожаловать в VoiceFlow — премиальное приложение для озвучивания текста. Надеюсь, вам понравится наш современный дизайн и качественный синтез речи!",
        story: "В тихом городке на краю леса жил часовщик по имени Марк. Он умел создавать удивительные механизмы, которые казались живыми. Однажды он собрал крошечную механическую птицу, которая пела по утрам чистым, волшебным голосом.",
        pitch: "Уважаемые инвесторы! Сегодня мы рады представить наш новый продукт. Это революционная платформа на базе искусственного интеллекта, которая сокращает затраты на озвучивание контента более чем на восемьдесят процентов.",
        tongue: "Шла Саша по шоссе и сосала сушку. Карл у Клары украл кораллы, а Клара у Карла украла кларнет."
    };

    // ==========================================
    // THEME SYSTEM
    // ==========================================
    const initTheme = () => {
        const savedTheme = localStorage.getItem('voiceflow-theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
    };

    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('voiceflow-theme', newTheme);
        showToast(newTheme === 'dark' ? 'Темная тема включена' : 'Светлая тема включена', 'info');
    });

    initTheme();

    // ==========================================
    // TEXTAREA & BACKDROP SYNCING (HIGHLIGHTING)
    // ==========================================
    
    // Escape HTML to prevent injection issues in backdrop
    const escapeHtml = (text) => {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };

    // Scroll sync
    textInput.addEventListener('scroll', () => {
        textBackdrop.scrollTop = textInput.scrollTop;
    });

    // Populate backdrop initially
    const updateBackdrop = (highlightIndex = -1, highlightLength = 0) => {
        const text = textInput.value;
        if (!text) {
            textBackdrop.innerHTML = '<span style="color: var(--text-muted)">Введите здесь текст для озвучивания...</span>';
            return;
        }

        if (highlightIndex === -1 || highlightIndex >= text.length) {
            textBackdrop.innerHTML = escapeHtml(text);
            return;
        }

        // Split text into: before, active word, and after
        const partBefore = text.substring(0, highlightIndex);
        const partActive = text.substring(highlightIndex, highlightIndex + highlightLength);
        const partAfter = text.substring(highlightIndex + highlightLength);

        textBackdrop.innerHTML = 
            escapeHtml(partBefore) + 
            '<span class="highlight">' + escapeHtml(partActive) + '</span>' + 
            escapeHtml(partAfter);
            
        // Ensure scroll matches correctly
        textBackdrop.scrollTop = textInput.scrollTop;
    };

    textInput.addEventListener('input', () => {
        updateStats();
        updateBackdrop();
    });

    // Stats calculations
    const updateStats = () => {
        const text = textInput.value.trim();
        const chars = text.length;
        const words = text ? text.split(/\s+/).length : 0;
        
        charCount.textContent = chars;
        wordCount.textContent = words;
        
        // Average speaking rate: ~120 words per minute (2 words per second)
        const currentRate = parseFloat(rateSlider.value);
        const estimatedSeconds = words ? Math.round(words / (2 * currentRate)) : 0;
        
        if (estimatedSeconds < 60) {
            timeEstimate.textContent = `${estimatedSeconds} сек`;
        } else {
            const minutes = Math.floor(estimatedSeconds / 60);
            const seconds = estimatedSeconds % 60;
            timeEstimate.textContent = `${minutes} мин ${seconds} сек`;
        }
    };

    // Presets loaders
    document.querySelectorAll('.btn-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            const templateKey = btn.getAttribute('data-template');
            if (templates[templateKey]) {
                stopSpeech();
                textInput.value = templates[templateKey];
                updateStats();
                updateBackdrop();
                showToast(`Загружен шаблон "${btn.textContent}"`, 'info');
            }
        });
    });

    // Clear Text
    btnClear.addEventListener('click', () => {
        stopSpeech();
        textInput.value = '';
        updateStats();
        updateBackdrop();
        showToast('Поле очищено', 'info');
    });

    // Paste Text
    btnPaste.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                stopSpeech();
                textInput.value = text;
                updateStats();
                updateBackdrop();
                showToast('Текст вставлен из буфера', 'success');
            } else {
                showToast('Буфер обмена пуст', 'error');
            }
        } catch (err) {
            showToast('Не удалось получить доступ к буферу обмена', 'error');
        }
    });

    // ==========================================
    // SPEECH SYNTHESIS ENGINE
    // ==========================================
    
    // Load voices
    const populateVoices = () => {
        if (!synth) return;
        
        voices = synth.getVoices();
        
        // Sort voices: Russian first, then English, then the rest
        voices.sort((a, b) => {
            const aLang = a.lang.toLowerCase();
            const bLang = b.lang.toLowerCase();
            
            const aIsRu = aLang.startsWith('ru');
            const bIsRu = bLang.startsWith('ru');
            const aIsEn = aLang.startsWith('en');
            const bIsEn = bLang.startsWith('en');
            
            if (aIsRu && !bIsRu) return -1;
            if (!aIsRu && bIsRu) return 1;
            if (aIsEn && !bIsEn) return -1;
            if (!aIsEn && bIsEn) return 1;
            
            return a.name.localeCompare(b.name);
        });

        // Populate dropdown
        voiceSelect.innerHTML = '';
        
        if (voices.length === 0) {
            const opt = document.createElement('option');
            opt.textContent = 'Голоса не найдены в вашей ОС';
            opt.disabled = true;
            voiceSelect.appendChild(opt);
            return;
        }

        voices.forEach((voice, index) => {
            const option = document.createElement('option');
            option.value = index;
            
            // Format voice name beautifully
            let langName = voice.lang;
            if (voice.lang.toLowerCase().startsWith('ru')) langName = 'Русский 🇷🇺';
            else if (voice.lang.toLowerCase().startsWith('en')) langName = 'Английский 🇺🇸';
            else if (voice.lang.toLowerCase().startsWith('de')) langName = 'Немецкий 🇩🇪';
            else if (voice.lang.toLowerCase().startsWith('fr')) langName = 'Французский 🇫🇷';
            else if (voice.lang.toLowerCase().startsWith('es')) langName = 'Испанский 🇪🇸';
            else if (voice.lang.toLowerCase().startsWith('it')) langName = 'Итальянский 🇮🇹';
            
            const isLocal = voice.localService ? 'Локальный' : 'Облачный';
            option.textContent = `${voice.name} (${langName}) — ${isLocal}`;
            
            // Set default voice (prefer Russian if available)
            if (voice.lang.toLowerCase().startsWith('ru') && !voiceSelect.querySelector('option[selected]')) {
                option.selected = true;
            }
            
            voiceSelect.appendChild(option);
        });

        // If no Russian voice selected, default to first option
        if (!voiceSelect.value && voices.length > 0) {
            voiceSelect.options[0].selected = true;
        }
    };

    // Edge/Chrome compatibility for async voice loading
    if (synth) {
        populateVoices();
        if (synth.onvoiceschanged !== undefined) {
            synth.onvoiceschanged = populateVoices;
        }
    }

    // Playback Logic
    const speakText = () => {
        const text = textInput.value.trim();
        if (!text) {
            showToast('Пожалуйста, введите текст для озвучивания', 'error');
            return;
        }

        if (isSpeaking) {
            if (isPaused) {
                // Resume Speech
                synth.resume();
                isPaused = false;
                updatePlaybackUI('speaking');
                showToast('Воспроизведение возобновлено', 'info');
            } else {
                // Pause Speech
                synth.pause();
                isPaused = true;
                updatePlaybackUI('paused');
                showToast('Воспроизведение приостановлено', 'info');
            }
            return;
        }

        // Standard Play flow
        synth.cancel(); // Stop any pending speech first

        const utterance = new SpeechSynthesisUtterance(text);
        
        // Apply settings
        const selectedVoiceIdx = voiceSelect.value;
        if (selectedVoiceIdx && voices[selectedVoiceIdx]) {
            utterance.voice = voices[selectedVoiceIdx];
        }
        
        utterance.rate = parseFloat(rateSlider.value);
        utterance.pitch = parseFloat(pitchSlider.value);
        utterance.volume = parseFloat(volumeSlider.value);

        // Boundary Highlighting Events
        utterance.onboundary = (event) => {
            if (event.name === 'word') {
                currentWordIndex = event.charIndex;
                
                // Determine word length (if browser supports event.charLength, otherwise extract manually)
                if (event.charLength !== undefined) {
                    currentWordLength = event.charLength;
                } else {
                    // Manual extraction of length based on whitespace/punctuation
                    const subText = text.substring(event.charIndex);
                    const match = subText.match(/^[\w\dа-яА-ЯёЁ]+/);
                    currentWordLength = match ? match[0].length : 1;
                }
                
                updateBackdrop(currentWordIndex, currentWordLength);
            }
        };

        // Event hooks
        utterance.onstart = () => {
            isSpeaking = true;
            isPaused = false;
            currentUtterance = utterance;
            updatePlaybackUI('speaking');
            btnStop.disabled = false;
            waveTargetAmplitude = 30 * parseFloat(volumeSlider.value); // Scale visualizer amplitude by volume
        };

        utterance.onend = () => {
            isSpeaking = false;
            isPaused = false;
            currentUtterance = null;
            updatePlaybackUI('stopped');
            btnStop.disabled = true;
            updateBackdrop(); // Reset highlights
            waveTargetAmplitude = 0; // Flatten waveform
            showToast('Озвучивание завершено', 'success');
        };

        utterance.onerror = (e) => {
            // Speech syntheses errors might fire when cancelled manually, ignore those
            if (e.error !== 'interrupted') {
                isSpeaking = false;
                isPaused = false;
                currentUtterance = null;
                updatePlaybackUI('stopped');
                btnStop.disabled = true;
                updateBackdrop();
                waveTargetAmplitude = 0;
                showToast(`Ошибка озвучивания: ${e.error}`, 'error');
            }
        };

        synth.speak(utterance);
    };

    const stopSpeech = () => {
        if (synth && (isSpeaking || isPaused)) {
            synth.cancel();
            isSpeaking = false;
            isPaused = false;
            currentUtterance = null;
            updatePlaybackUI('stopped');
            btnStop.disabled = true;
            updateBackdrop();
            waveTargetAmplitude = 0;
            showToast('Воспроизведение остановлено', 'info');
        }
    };

    const updatePlaybackUI = (state) => {
        const playIcon = btnPlay.querySelector('.play-icon');
        const pauseIcon = btnPlay.querySelector('.pause-icon');
        const btnLabel = btnPlay.querySelector('.btn-label');

        if (state === 'speaking') {
            btnPlay.classList.add('speaking');
            playIcon.classList.add('hidden');
            pauseIcon.classList.remove('hidden');
            btnLabel.textContent = 'Пауза';
            
            // Visualizer Status
            visualizerStatusIndicator.className = 'status-indicator speaking';
            visualizerStatusText.textContent = 'Синтез речи активен...';
        } else if (state === 'paused') {
            btnPlay.classList.remove('speaking');
            playIcon.classList.remove('hidden');
            pauseIcon.classList.add('hidden');
            btnLabel.textContent = 'Продолжить';
            
            // Visualizer Status
            visualizerStatusIndicator.className = 'status-indicator paused';
            visualizerStatusText.textContent = 'Приостановлено';
        } else {
            // Stopped / Ended
            btnPlay.classList.remove('speaking');
            playIcon.classList.remove('hidden');
            pauseIcon.classList.add('hidden');
            btnLabel.textContent = 'Озвучить';
            
            // Visualizer Status
            visualizerStatusIndicator.className = 'status-indicator';
            visualizerStatusText.textContent = 'Готов к воспроизведению';
        }
    };

    btnPlay.addEventListener('click', speakText);
    btnStop.addEventListener('click', stopSpeech);

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl + Enter to Play/Pause
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            speakText();
        }
        // Escape to stop
        if (e.key === 'Escape') {
            if (isSpeaking || isPaused) {
                e.preventDefault();
                stopSpeech();
            }
        }
    });

    // ==========================================
    // SLIDERS CONTROLLER
    // ==========================================
    rateSlider.addEventListener('input', () => {
        rateValue.textContent = `${parseFloat(rateSlider.value).toFixed(1)}x`;
        updateStats(); // Speed slider changes estimated duration
    });

    pitchSlider.addEventListener('input', () => {
        pitchValue.textContent = `${parseFloat(pitchSlider.value).toFixed(1)}`;
    });

    volumeSlider.addEventListener('input', () => {
        const percent = Math.round(parseFloat(volumeSlider.value) * 100);
        volumeValue.textContent = `${percent}%`;
        if (isSpeaking && !isPaused) {
            waveTargetAmplitude = 30 * parseFloat(volumeSlider.value);
        }
    });

    // Preset Slider Buttons
    document.querySelectorAll('.btn-preset-val').forEach(btn => {
        btn.addEventListener('click', () => {
            const sliderType = btn.getAttribute('data-slider');
            const targetVal = parseFloat(btn.getAttribute('data-val'));
            
            // Handle speed or pitch mapping
            if (sliderType === 'rate') {
                rateSlider.value = targetVal;
                rateSlider.dispatchEvent(new Event('input'));
                
                // Highlight active preset button
                document.querySelectorAll('.btn-preset-val[data-slider="rate"]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            } else if (sliderType === 'pitch') {
                pitchSlider.value = targetVal;
                pitchSlider.dispatchEvent(new Event('input'));
                
                // Highlight active preset button
                document.querySelectorAll('.btn-preset-val[data-slider="pitch"]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            }
        });
    });

    // ==========================================
    // MATHEMATICAL 60FPS WAVEFORM VISUALIZER
    // ==========================================
    const resizeCanvas = () => {
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas(); // initial size

    const drawWaveform = () => {
        ctx.clearRect(0, 0, canvas.width / window.devicePixelRatio, canvas.height / window.devicePixelRatio);
        
        const w = canvas.width / window.devicePixelRatio;
        const h = canvas.height / window.devicePixelRatio;
        const midY = h / 2;
        
        // Smoothly interpolate amplitude to target (so it doesn't snap suddenly)
        waveCurrentAmplitude += (waveTargetAmplitude - waveCurrentAmplitude) * 0.1;
        
        // Active sliders variables mapping
        const currentRate = parseFloat(rateSlider.value);
        const currentPitch = parseFloat(pitchSlider.value);
        
        // Set dynamic wave phase offset speed based on voice rate
        const speedMultiplier = isPaused ? 0.05 : (isSpeaking ? currentRate * 0.15 : 0.02);
        waveOffset += speedMultiplier;

        // Draw multiple overlapping transparent waves for 3D premium fluid depth
        const drawSingleWave = (color, amplitude, frequency, offset, lineW) => {
            ctx.beginPath();
            ctx.lineWidth = lineW;
            ctx.strokeStyle = color;
            ctx.shadowBlur = isSpeaking ? 15 : 0;
            ctx.shadowColor = color;
            
            // Adjust wave parameters by voice pitch
            const pitchFreqMultiplier = currentPitch * 0.8;
            
            for (let x = 0; x < w; x++) {
                // Sine wave equation with boundary fading (dampens waves at left/right edges for studio feel)
                const fadeFactor = Math.sin((x / w) * Math.PI); // 0 at edges, 1 at center
                const y = midY + Math.sin(x * frequency * pitchFreqMultiplier + offset) * amplitude * fadeFactor;
                
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        };

        // Draw 3 layers
        const isThemeDark = document.documentElement.getAttribute('data-theme') === 'dark';
        
        if (waveCurrentAmplitude > 0.5) {
            // Speaking Waves: Violet, Cyan, and Magenta overlaps
            const primaryColor = isThemeDark ? 'rgba(99, 102, 241, 0.75)' : 'rgba(79, 70, 229, 0.8)';
            const secondaryColor = isThemeDark ? 'rgba(14, 165, 233, 0.6)' : 'rgba(2, 132, 199, 0.7)';
            const tertiaryColor = isThemeDark ? 'rgba(236, 72, 153, 0.5)' : 'rgba(219, 39, 119, 0.6)';
            
            // Draw secondary back wave
            drawSingleWave(tertiaryColor, waveCurrentAmplitude * 0.7, 0.012, -waveOffset * 0.8, 1.5);
            // Draw secondary front wave
            drawSingleWave(secondaryColor, waveCurrentAmplitude * 0.85, 0.022, waveOffset * 1.2, 2.0);
            // Draw main primary wave
            drawSingleWave(primaryColor, waveCurrentAmplitude, 0.015, waveOffset, 3.0);
        } else {
            // Idle State: Soft ripple baseline
            const idleColor = isThemeDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
            drawSingleWave(idleColor, 4, 0.01, waveOffset * 0.2, 1.5);
        }
        
        // Reset shadows
        ctx.shadowBlur = 0;

        animationId = requestAnimationFrame(drawWaveform);
    };

    drawWaveform();

    // ==========================================
    // LOCAL STORAGE BOOKMARKS SYSTEM
    // ==========================================
    const loadBookmarks = () => {
        const saved = localStorage.getItem('voiceflow-bookmarks');
        const bookmarks = saved ? JSON.parse(saved) : [];
        
        bookmarkCountBadge.textContent = bookmarks.length;
        
        if (bookmarks.length === 0) {
            bookmarksEmpty.classList.remove('hidden');
            bookmarksList.classList.add('hidden');
            return;
        }

        bookmarksEmpty.classList.add('hidden');
        bookmarksList.classList.remove('hidden');
        bookmarksList.innerHTML = '';

        bookmarks.forEach(bookmark => {
            const li = document.createElement('li');
            li.className = 'bookmark-item';
            
            // Format voice readable name or locale code
            const voiceShort = bookmark.voiceName ? bookmark.voiceName.split(' ')[0] : 'По умолчанию';

            li.innerHTML = `
                <div class="bookmark-content">
                    <div class="bookmark-text" title="${escapeHtml(bookmark.text)}">${escapeHtml(bookmark.text)}</div>
                    <div class="bookmark-meta">
                        <span><i data-lucide="volume-2" style="width:10px;height:10px;vertical-align:middle;margin-right:2px"></i> ${voiceShort}</span>
                        <span>Скорость: ${bookmark.rate}x</span>
                        <span>Высота: ${bookmark.pitch}</span>
                    </div>
                </div>
                <div class="bookmark-actions">
                    <button class="btn-sm-action play-bookmark" title="Озвучить немедленно" data-id="${bookmark.id}">
                        <i data-lucide="play" style="width:14px;height:14px"></i>
                    </button>
                    <button class="btn-sm-action load-bookmark" title="Загрузить в редактор" data-id="${bookmark.id}">
                        <i data-lucide="external-link" style="width:14px;height:14px"></i>
                    </button>
                    <button class="btn-sm-action delete-bookmark" title="Удалить" data-id="${bookmark.id}">
                        <i data-lucide="trash-2" style="width:14px;height:14px"></i>
                    </button>
                </div>
            `;
            
            bookmarksList.appendChild(li);
        });

        // Re-trigger Lucide icon transformation inside dynamic list
        lucide.createIcons();
        attachBookmarkEvents(bookmarks);
    };

    const attachBookmarkEvents = (bookmarks) => {
        // Play directly
        document.querySelectorAll('.play-bookmark').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const item = bookmarks.find(b => b.id === id);
                if (item) {
                    stopSpeech();
                    textInput.value = item.text;
                    updateStats();
                    updateBackdrop();
                    
                    // Match slider values
                    rateSlider.value = item.rate;
                    rateSlider.dispatchEvent(new Event('input'));
                    pitchSlider.value = item.pitch;
                    pitchSlider.dispatchEvent(new Event('input'));
                    volumeSlider.value = item.volume;
                    volumeSlider.dispatchEvent(new Event('input'));
                    
                    // Select correct voice index
                    let matchedVoiceIdx = -1;
                    if (item.voiceName) {
                        matchedVoiceIdx = voices.findIndex(v => v.name === item.voiceName);
                    }
                    if (matchedVoiceIdx !== -1) {
                        voiceSelect.value = matchedVoiceIdx;
                    }

                    setTimeout(() => speakText(), 100);
                    showToast('Воспроизведение сохраненной фразы...', 'success');
                }
            });
        });

        // Load into editor only
        document.querySelectorAll('.load-bookmark').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const item = bookmarks.find(b => b.id === id);
                if (item) {
                    stopSpeech();
                    textInput.value = item.text;
                    updateStats();
                    updateBackdrop();
                    
                    // Load sliders
                    rateSlider.value = item.rate;
                    rateSlider.dispatchEvent(new Event('input'));
                    pitchSlider.value = item.pitch;
                    pitchSlider.dispatchEvent(new Event('input'));
                    volumeSlider.value = item.volume;
                    volumeSlider.dispatchEvent(new Event('input'));
                    
                    // Select correct voice
                    let matchedVoiceIdx = -1;
                    if (item.voiceName) {
                        matchedVoiceIdx = voices.findIndex(v => v.name === item.voiceName);
                    }
                    if (matchedVoiceIdx !== -1) {
                        voiceSelect.value = matchedVoiceIdx;
                    }

                    showToast('Фраза загружена в редактор', 'info');
                }
            });
        });

        // Delete bookmark
        document.querySelectorAll('.delete-bookmark').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const updated = bookmarks.filter(b => b.id !== id);
                localStorage.setItem('voiceflow-bookmarks', JSON.stringify(updated));
                loadBookmarks();
                showToast('Фраза удалена', 'info');
            });
        });
    };

    btnBookmark.addEventListener('click', () => {
        const text = textInput.value.trim();
        if (!text) {
            showToast('Введите текст перед сохранением', 'error');
            return;
        }

        const currentVoices = synth.getVoices();
        const selectedVoiceIdx = voiceSelect.value;
        const voiceObj = selectedVoiceIdx !== "" && currentVoices[selectedVoiceIdx] ? currentVoices[selectedVoiceIdx] : null;
        
        const newBookmark = {
            id: Date.now().toString(),
            text: text,
            voiceName: voiceObj ? voiceObj.name : '',
            rate: parseFloat(rateSlider.value),
            pitch: parseFloat(pitchSlider.value),
            volume: parseFloat(volumeSlider.value),
            timestamp: new Date().toISOString()
        };

        const saved = localStorage.getItem('voiceflow-bookmarks');
        const bookmarks = saved ? JSON.parse(saved) : [];
        
        // Prevent exact duplicates
        const exists = bookmarks.some(b => b.text === text && b.voiceName === newBookmark.voiceName);
        if (exists) {
            showToast('Этот текст с таким же голосом уже сохранен', 'error');
            return;
        }

        bookmarks.unshift(newBookmark);
        localStorage.setItem('voiceflow-bookmarks', JSON.stringify(bookmarks));
        loadBookmarks();
        showToast('Текст сохранен в избранное', 'success');
    });

    // Populate bookmarks on load
    loadBookmarks();

    // ==========================================
    // TOAST NOTIFICATIONS HELPER
    // ==========================================
    const showToast = (message, type = 'info') => {
        const toast = document.createElement('div');
        toast.className = `toast ${type}-toast`;
        
        let iconName = 'info';
        if (type === 'success') iconName = 'check-circle';
        if (type === 'error') iconName = 'alert-triangle';

        toast.innerHTML = `
            <i data-lucide="${iconName}" class="toast-icon ${type}"></i>
            <span class="toast-message">${message}</span>
        `;
        
        toastContainer.appendChild(toast);
        lucide.createIcons(); // Transform icon

        // Smooth fade out & cleanup
        setTimeout(() => {
            toast.style.transform = 'translateY(-20px)';
            toast.style.opacity = '0';
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3000);
    };

    // Prepopulate welcome text
    textInput.value = "Привет! Это VoiceFlow — высокотехнологичный синтезатор речи, работающий прямо в вашем браузере. Выберите голос справа, настройте скорость и высоту звучания, а затем нажмите кнопку «Озвучить». Наблюдайте за плавным движением аудиоволн и подсветкой каждого произносимого слова!";
    updateStats();
    updateBackdrop();
});
