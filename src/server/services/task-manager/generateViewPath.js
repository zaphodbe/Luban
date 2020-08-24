import fs from 'fs';
import { pathWithRandomSuffix } from '../../../shared/lib/random-utils';
import DataStorage from '../../DataStorage';
import SVGParser from '../../../shared/lib/SVGParser';
import { parseDxf, dxfToSvg, updateDxfBoundingBox } from '../../../shared/lib/DXFParser/Parser';
import CncToolPathGenerator from '../../lib/ToolPathGenerator/CncToolPathGenerator';
import CncReliefToolPathGenerator from '../../lib/ToolPathGenerator/CncReliefToolPathGenerator';
import logger from '../../lib/logger';

const log = logger('service:TaskManager');

const generateCncViewPath = async (modelInfo, onProgress) => {
    const suffix = '.json';
    const { sourceType, mode, uploadName } = modelInfo;
    const modelPath = `${DataStorage.tmpDir}/${uploadName}`;
    const outputFilename = pathWithRandomSuffix(`${uploadName}.${suffix}`);
    const outputFilePath = `${DataStorage.tmpDir}/${outputFilename}`;

    if (((sourceType === 'svg' || sourceType === 'dxf') && (mode === 'vector' || mode === 'trace')) || (sourceType === 'text' && mode === 'vector')) {
        let toolPath;
        if (sourceType === 'dxf') {
            let { svg } = await parseDxf(modelPath);
            svg = dxfToSvg(svg);
            updateDxfBoundingBox(svg);

            const generator = new CncToolPathGenerator();
            generator.on('progress', (p) => onProgress(p));
            toolPath = await generator.generateViewPathObj(svg, modelInfo);
        } else {
            const svgParser = new SVGParser();
            const svg = await svgParser.parseFile(modelPath);

            const generator = new CncToolPathGenerator();
            generator.on('progress', (p) => onProgress(p));
            toolPath = await generator.generateViewPathObj(svg, modelInfo);
        }
        return new Promise((resolve, reject) => {
            fs.writeFile(outputFilePath, JSON.stringify(toolPath), 'utf8', (err) => {
                if (err) {
                    log.error(err);
                    reject(err);
                } else {
                    resolve({
                        viewPathFile: outputFilename
                    });
                }
            });
        });
    } else if (sourceType === 'raster' && mode === 'greyscale') {
        const generator = new CncReliefToolPathGenerator(modelInfo, modelPath);
        generator.on('progress', (p) => onProgress(p));

        const toolPath = await generator.generateToolPathObj();

        return new Promise((resolve, reject) => {
            fs.writeFile(outputFilePath, JSON.stringify(toolPath), 'utf8', (err) => {
                if (err) {
                    log.error(err);
                    reject(err);
                } else {
                    resolve({
                        viewPathFile: outputFilename
                    });
                }
            });
        });
    } else {
        return Promise.reject(new Error(`Unexpected params: type = ${sourceType} mode = ${mode}`));
    }
};

export const generateViewPath = (modelInfo, onProgress) => {
    if (!modelInfo) {
        return Promise.reject(new Error('modelInfo is empty.'));
    }

    const { headType } = modelInfo;
    if (headType === 'cnc') {
        return generateCncViewPath(modelInfo, onProgress);
    } else {
        return Promise.reject(new Error(`Unsupported type: ${headType}`));
    }
};
