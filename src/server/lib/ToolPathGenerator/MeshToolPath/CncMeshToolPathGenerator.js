import EventEmitter from 'events';
import { CNC_MESH_SLICE_MODE_ROTATION, FACE_BACK, FACE_FRONT, FACE_LEFT, FACE_RIGHT } from '../../../constants';
import DataStorage from '../../../DataStorage';
import CncReliefToolPathGenerator from '../CncReliefToolPathGenerator';
import { MeshProcess } from '../../MeshProcess/MeshProcess';
import XToBToolPath from '../../ToolPath/XToBToolPath';

export default class CncMeshToolPathGenerator extends EventEmitter {
    constructor(modelInfo) {
        super();
        const { uploadName, gcodeConfig = {}, transformation = {}, processImageName, materials } = modelInfo;
        const { isRotate, diameter } = materials;

        const { density = 5, toolAngle = 20, sliceMode = CNC_MESH_SLICE_MODE_ROTATION } = gcodeConfig;

        this.modelInfo = modelInfo;
        this.uploadName = uploadName;
        this.processImageName = processImageName;
        this.transformation = transformation;
        this.gcodeConfig = gcodeConfig;

        this.sliceMode = sliceMode;

        this.density = density;

        this.isRotate = isRotate;
        this.diameter = diameter;

        this.toolPath = new XToBToolPath({ isRotate, radius: diameter / 2 });

        this.toolAngle = toolAngle;
    }

    async generateToolPathSliceModeRotation() {
        const modelPath = `${DataStorage.tmpDir}/${this.processImageName}`;

        const generator = new CncReliefToolPathGenerator(this.modelInfo, modelPath);
        generator.on('progress', (p) => {
            this.emit('progress', p);
        });

        const toolPath = await generator.generateToolPathObj();
        return toolPath;
    }

    async generateToolPathSliceModeMultiFace() {
        const meshProcess = new MeshProcess(this.modelInfo);
        const { width, height } = meshProcess.getWidthAndHeight();
        meshProcess.mesh.resize({
            x: this.transformation.width / width,
            y: this.transformation.width / width,
            z: this.transformation.height / height
        });

        const parseToToolPath = async (face) => {
            meshProcess.mesh.setCoordinateSystem(face);
            meshProcess.mesh.offset({
                x: -meshProcess.mesh.aabb.min.x,
                y: -(meshProcess.mesh.aabb.min.y + meshProcess.mesh.aabb.max.y) / 2,
                z: -meshProcess.mesh.aabb.min.z
            });
            const res = await meshProcess.convertTo3AxisImage();
            const modelInfo = {
                ...this.modelInfo,
                isRotate: false,
                transformation: {
                    ...this.modelInfo.transformation,
                    width: res.width,
                    height: res.height
                }
            };
            const modelPath = `${DataStorage.tmpDir}/${res.filename}`;
            const generator = new CncReliefToolPathGenerator(modelInfo, modelPath);
            generator.initialZ = this.diameter / 2;
            generator.imageInitalZ = meshProcess.mesh.aabb.length.y / 2;
            generator.imageFinalZ = 0;
            const toolPath = await generator.generateToolPathObj();
            return toolPath;
        };

        const faces = [FACE_FRONT, FACE_RIGHT, FACE_BACK, FACE_LEFT];

        const { jogSpeed } = this.gcodeConfig;

        for (let i = 0; i < faces.length; i++) {
            const toolPath = await parseToToolPath(faces[i]);
            for (const command of toolPath.data) {
                this.toolPath.setCommand(command);
            }
            if (i !== faces.length - 1) {
                this.toolPath.move0B((i + 1) * 90, jogSpeed);
            }
        }

        const boundingBox = this.toolPath.boundingBox;
        const { positionX } = this.transformation;

        if (this.isRotate) {
            boundingBox.max.b += this.toolPath.toB(positionX);
            boundingBox.min.b += this.toolPath.toB(positionX);
        } else {
            boundingBox.max.x += positionX;
            boundingBox.min.x += positionX;
        }
        boundingBox.max.y += this.transformation.positionY;
        boundingBox.min.y += this.transformation.positionY;

        const { headType, mode, isCW } = this.modelInfo;

        return {
            headType: headType,
            mode: mode,
            movementMode: '',
            data: this.toolPath.commands,
            estimatedTime: this.toolPath.estimatedTime * 1.6,
            positionX: this.isRotate ? 0 : this.transformation.positionX,
            positionY: this.transformation.positionY,
            positionZ: this.transformation.positionZ,
            rotationB: this.isRotate ? this.toolPath.toB(this.transformation.positionX) : 0,
            boundingBox: boundingBox,
            isRotate: this.isRotate,
            diameter: this.diameter,
            isCW: isCW
        };
    }

    async generateToolPathObj() {
        let res = null;
        if (this.isRotate) {
            if (this.sliceMode === CNC_MESH_SLICE_MODE_ROTATION) {
                res = await this.generateToolPathSliceModeRotation();
            } else {
                res = await this.generateToolPathSliceModeMultiFace();
            }
        } else {
            res = await this.generateToolPathSliceModeRotation();
        }

        return res;
    }
}
