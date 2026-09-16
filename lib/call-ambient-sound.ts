// lib/call-ambient-sound.ts
// 通话伴随环境音 (Procedural Ambient Sound & Custom Audio Player)
//
// 在角色 TTS 开口说话时，同步伴随播放轻柔的环境背景音（细雨、风声、白噪音、海浪、蝉鸣等），
// 角色说话结束时平滑淡出，不干扰用户说话与麦克风录音。

export type AmbientSoundType =
    | "none"
    | "rain"
    | "wind"
    | "white_noise"
    | "waves"
    | "crowd"
    | "bird"
    | "cicada"
    | "custom";

export interface AmbientSoundOption {
    id: AmbientSoundType;
    label: string;
    description: string;
}

export const AMBIENT_SOUND_OPTIONS: AmbientSoundOption[] = [
    { id: "none", label: "无环境音", description: "关闭通话伴随背景音" },
    { id: "rain", label: "🌧️ 细雨淅淅", description: "轻柔窗外小雨声，伴有微弱水滴声" },
    { id: "wind", label: "🍃 阵阵微风", description: "大自然微风阵阵吹拂的舒缓声" },
    { id: "white_noise", label: "📻 柔和白噪音", description: "舒适平缓的粉红底噪，安神助眠" },
    { id: "waves", label: "🌊 潮汐海浪", description: "海浪轻柔拍打沙滩的潮起潮落" },
    { id: "bird", label: "🌙 夜莺轻啼", description: "宁静夜幕下偶有空灵清澈的夜鸟鸣叫" },
    { id: "cicada", label: "🌿 夏日蝉鸣", description: "夏夜树梢间远处悠长的蝉鸣呢喃" },
    { id: "crowd", label: "☕ 咖啡馆熙攘", description: "温暖模糊的人声背景与咖啡馆氛围" },
    { id: "custom", label: "🔗 自定义音频", description: "使用自定义音频直链或 MP3 URL" },
];

let _ambientCtx: AudioContext | null = null;
let _activeStopFn: (() => void) | null = null;
let _customAudio: HTMLAudioElement | null = null;

function getAmbientContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    if (!_ambientCtx) {
        try {
            _ambientCtx = new Ctor();
        } catch {
            return null;
        }
    }
    if (_ambientCtx && _ambientCtx.state === "suspended") {
        _ambientCtx.resume().catch(() => {});
    }
    return _ambientCtx;
}

/** 生成 5 秒的粉红/白/布朗混合基础噪波 Buffer */
function createNoiseBuffer(ctx: AudioContext, type: "white" | "pink" | "brown"): AudioBuffer {
    const bufferSize = ctx.sampleRate * 5;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);

    if (type === "white") {
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
    } else if (type === "pink") {
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.96900 * b2 + white * 0.1538520;
            b3 = 0.86650 * b3 + white * 0.3104856;
            b4 = 0.55000 * b4 + white * 0.5329522;
            b5 = -0.7616 * b5 - white * 0.0168980;
            output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
            b6 = white * 0.115926;
        }
    } else {
        // Brown noise
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            output[i] = (lastOut + (0.02 * white)) / 1.02;
            lastOut = output[i];
            output[i] *= 3.5; // Gain compensation
        }
    }
    return buffer;
}

/** 启动程序合成环境音 */
function startProceduralAmbient(soundType: AmbientSoundType, volume: number): () => void {
    const ctx = getAmbientContext();
    if (!ctx) return () => {};

    const masterGain = ctx.createGain();
    const targetGain = Math.max(0.01, Math.min(1, volume));
    masterGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    // 平滑淡入 0.4 秒
    masterGain.gain.exponentialRampToValueAtTime(targetGain, ctx.currentTime + 0.4);
    masterGain.connect(ctx.destination);

    const activeNodes: Array<{ stop?: () => void; disconnect: () => void }> = [];
    const activeTimers: number[] = [];

    if (soundType === "white_noise") {
        const noiseBuf = createNoiseBuffer(ctx, "pink");
        const src = ctx.createBufferSource();
        src.buffer = noiseBuf;
        src.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 850;

        src.connect(filter);
        filter.connect(masterGain);
        src.start();
        activeNodes.push(src, filter);
    } else if (soundType === "rain") {
        // 雨声：粉红噪音 + 较宽带通 + 偶发雨滴
        const noiseBuf = createNoiseBuffer(ctx, "pink");
        const src = ctx.createBufferSource();
        src.buffer = noiseBuf;
        src.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = 1400;
        filter.Q.value = 0.6;

        src.connect(filter);
        filter.connect(masterGain);
        src.start();
        activeNodes.push(src, filter);

        // 雨滴随机声
        const rainTimer = window.setInterval(() => {
            if (!ctx || ctx.state === "closed") return;
            const drop = ctx.createOscillator();
            const dropGain = ctx.createGain();
            drop.type = "sine";
            drop.frequency.setValueAtTime(2000 + Math.random() * 1200, ctx.currentTime);
            drop.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.04);
            dropGain.gain.setValueAtTime(targetGain * 0.18, ctx.currentTime);
            dropGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.04);
            drop.connect(dropGain);
            dropGain.connect(masterGain);
            drop.start();
            drop.stop(ctx.currentTime + 0.05);
        }, 180);
        activeTimers.push(rainTimer);
    } else if (soundType === "wind") {
        // 微风：布朗噪音 + 低频缓动 LFO
        const noiseBuf = createNoiseBuffer(ctx, "brown");
        const src = ctx.createBufferSource();
        src.buffer = noiseBuf;
        src.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 350;

        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.type = "sine";
        lfo.frequency.value = 0.18; // 周期约 5.5 秒的微风起伏
        lfoGain.gain.value = 180;
        lfo.connect(filter.frequency);

        src.connect(filter);
        filter.connect(masterGain);

        src.start();
        lfo.start();
        activeNodes.push(src, lfo, filter, lfoGain);
    } else if (soundType === "waves") {
        // 海浪：布朗噪音 + 呼吸般潮汐消长
        const noiseBuf = createNoiseBuffer(ctx, "brown");
        const src = ctx.createBufferSource();
        src.buffer = noiseBuf;
        src.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 400;

        const waveLfo = ctx.createOscillator();
        const waveGain = ctx.createGain();
        waveLfo.type = "sine";
        waveLfo.frequency.value = 0.14; // 约 7 秒一波浪潮
        waveGain.gain.value = 240;
        waveLfo.connect(filter.frequency);

        src.connect(filter);
        filter.connect(masterGain);

        src.start();
        waveLfo.start();
        activeNodes.push(src, waveLfo, filter, waveGain);
    } else if (soundType === "bird") {
        // 夜莺：底噪极其微弱，主要是间歇清幽鸣叫
        const noiseBuf = createNoiseBuffer(ctx, "pink");
        const src = ctx.createBufferSource();
        src.buffer = noiseBuf;
        src.loop = true;

        const bgFilter = ctx.createBiquadFilter();
        bgFilter.type = "lowpass";
        bgFilter.frequency.value = 300;
        const bgGain = ctx.createGain();
        bgGain.gain.value = 0.08;

        src.connect(bgFilter);
        bgFilter.connect(bgGain);
        bgGain.connect(masterGain);
        src.start();
        activeNodes.push(src, bgFilter, bgGain);

        const playBirdChirp = () => {
            if (!ctx || ctx.state === "closed") return;
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            // 清脆滑音
            osc.frequency.setValueAtTime(2400, now);
            osc.frequency.exponentialRampToValueAtTime(3200, now + 0.08);
            osc.frequency.exponentialRampToValueAtTime(2200, now + 0.18);

            gain.gain.setValueAtTime(0.001, now);
            gain.gain.linearRampToValueAtTime(targetGain * 0.28, now + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

            osc.connect(gain);
            gain.connect(masterGain);
            osc.start(now);
            osc.stop(now + 0.25);
        };

        const birdTimer = window.setInterval(() => {
            if (Math.random() > 0.35) {
                playBirdChirp();
                if (Math.random() > 0.5) {
                    window.setTimeout(playBirdChirp, 240);
                }
            }
        }, 1900);
        activeTimers.push(birdTimer);
    } else if (soundType === "cicada") {
        // 夏日蝉鸣：4.5kHz 快速幅值颤音
        const osc = ctx.createOscillator();
        const tremolo = ctx.createOscillator();
        const tremoloGain = ctx.createGain();
        const cicadaGain = ctx.createGain();

        osc.type = "sawtooth";
        osc.frequency.value = 4400;

        tremolo.type = "sine";
        tremolo.frequency.value = 13; // 13Hz 快速震翅
        tremoloGain.gain.value = 0.6;
        tremolo.connect(tremoloGain);

        const bandFilter = ctx.createBiquadFilter();
        bandFilter.type = "bandpass";
        bandFilter.frequency.value = 4500;
        bandFilter.Q.value = 5;

        cicadaGain.gain.value = 0.2;

        osc.connect(bandFilter);
        bandFilter.connect(cicadaGain);
        cicadaGain.connect(masterGain);

        osc.start();
        tremolo.start();
        activeNodes.push(osc, tremolo, tremoloGain, bandFilter, cicadaGain);
    } else if (soundType === "crowd") {
        // 咖啡馆熙攘人声
        const noiseBuf = createNoiseBuffer(ctx, "pink");
        const src = ctx.createBufferSource();
        src.buffer = noiseBuf;
        src.loop = true;

        const filter1 = ctx.createBiquadFilter();
        filter1.type = "bandpass";
        filter1.frequency.value = 650;
        filter1.Q.value = 1.2;

        const filter2 = ctx.createBiquadFilter();
        filter2.type = "bandpass";
        filter2.frequency.value = 1200;
        filter2.Q.value = 1.8;

        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.type = "sine";
        lfo.frequency.value = 0.4;
        lfoGain.gain.value = 0.3;
        lfo.connect(filter1.gain);

        src.connect(filter1);
        src.connect(filter2);
        filter1.connect(masterGain);
        filter2.connect(masterGain);

        src.start();
        lfo.start();
        activeNodes.push(src, lfo, filter1, filter2, lfoGain);
    }

    let isStopped = false;
    return () => {
        if (isStopped) return;
        isStopped = true;
        activeTimers.forEach(id => clearInterval(id));

        try {
            // 平滑淡出 0.3 秒，避免突然咔嗒声
            masterGain.gain.cancelScheduledValues(ctx.currentTime);
            masterGain.gain.setValueAtTime(masterGain.gain.value, ctx.currentTime);
            masterGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
            setTimeout(() => {
                activeNodes.forEach(node => {
                    try {
                        if (node.stop) node.stop();
                        node.disconnect();
                    } catch {}
                });
                masterGain.disconnect();
            }, 350);
        } catch {
            activeNodes.forEach(node => {
                try {
                    if (node.stop) node.stop();
                    node.disconnect();
                } catch {}
            });
            masterGain.disconnect();
        }
    };
}

/** 播放外部自定义音频 URL 作为环境音 */
function startCustomAudioAmbient(url: string, volume: number): () => void {
    if (typeof window === "undefined" || !url) return () => {};

    if (_customAudio) {
        try {
            _customAudio.pause();
            _customAudio.src = "";
        } catch {}
    }

    const audio = new Audio(url);
    _customAudio = audio;
    audio.loop = true;
    audio.volume = Math.max(0.01, Math.min(1, volume));
    audio.play().catch(e => {
        console.warn("[AmbientSound] Custom audio play failed:", e);
    });

    let isStopped = false;
    return () => {
        if (isStopped) return;
        isStopped = true;
        try {
            // 平滑淡出
            const fadeInterval = setInterval(() => {
                if (audio.volume > 0.05) {
                    audio.volume = Math.max(0, audio.volume - 0.05);
                } else {
                    clearInterval(fadeInterval);
                    audio.pause();
                    audio.src = "";
                    if (_customAudio === audio) _customAudio = null;
                }
            }, 50);
        } catch {
            audio.pause();
            audio.src = "";
            if (_customAudio === audio) _customAudio = null;
        }
    };
}

/**
 * 启动通话伴随背景音
 * @param soundConfig 环境音配置（预设名称或自定义 URL 直链）
 * @param volume 音量 (0..1，默认 0.25)
 * @returns 停止淡出的回调函数
 */
export function startCallAmbient(soundConfig?: string | null, volume: number = 0.25): () => void {
    stopCallAmbient();

    if (!soundConfig || soundConfig === "none") {
        return () => {};
    }

    const effectiveVolume = typeof volume === "number" && !isNaN(volume) ? volume : 0.25;

    let stopFn: () => void;
    if (soundConfig.startsWith("http://") || soundConfig.startsWith("https://") || soundConfig.startsWith("data:")) {
        stopFn = startCustomAudioAmbient(soundConfig, effectiveVolume);
    } else {
        stopFn = startProceduralAmbient(soundConfig as AmbientSoundType, effectiveVolume);
    }

    _activeStopFn = stopFn;
    return () => {
        stopFn();
        if (_activeStopFn === stopFn) {
            _activeStopFn = null;
        }
    };
}

/** 立即停止正在播放的通话环境音 */
export function stopCallAmbient(): void {
    if (_activeStopFn) {
        try {
            _activeStopFn();
        } catch {}
        _activeStopFn = null;
    }
}
