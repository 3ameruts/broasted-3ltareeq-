import { Config } from '@remotion/cli/config';

// 1080×1920 H.264 + AAC MP4 for Reels / Stories / TikTok
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setCodec('h264');
Config.setCrf(17);
Config.setPixelFormat('yuv420p');
Config.setAudioCodec('aac');
Config.setAudioBitrate('192k');
Config.setOverwriteOutput(true);
// a locally installed headless Chromium, when REMOTION_BROWSER is set
if (process.env.REMOTION_BROWSER) Config.setBrowserExecutable(process.env.REMOTION_BROWSER);
