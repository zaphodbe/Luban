import * as THREE from 'three';

const UNIFORMS = {
    // rgba
    u_g1_color: new THREE.Uniform(new THREE.Vector4(0, 0, 0, 1))
};

const CNC_LASER_VERT_SHADER = [
    'varying float v_g_code;',
    'attribute float a_g_code;',
    'void main(){',
    '    v_g_code = a_g_code;',
    '    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '}'
].join('');

const CNC_LASER_FRAG_SHADER = [
    'uniform vec4 u_g1_color;',
    'varying float v_g_code;',
    'void main(){',
    '    if(v_g_code == 0.0){',
    '        discard;',
    '    }',
    '    gl_FragColor = u_g1_color;',
    '}'
].join('');

const motionColor = {
    'G0': new THREE.Color(0xc8c8c8),
    'G1': new THREE.Color(0x000000),
    'unknown': new THREE.Color(0x000000)
};

class ToolPathRenderer {
    render(toolPath, isRotate = false) {
        const { headType, mode, movementMode, data } = toolPath;

        this.isRotate = isRotate;

        // now only support cnc&laser
        if (!['cnc', 'laser'].includes(headType)) {
            return null;
        }
        if (headType === 'laser') {
            if (mode === 'greyscale' && movementMode === 'greyscale-dot') {
                return this.parseToPoints(data);
            } else {
                return this.parseToLine(data);
            }
        } else {
            return this.parseToLine(data);
        }
    }

    parseToLine(data) {
        const positions = [];
        const gCodes = [];

        let state = {
            G: 0,
            X: 0,
            B: 0,
            Y: 0,
            Z: 0
        };
        for (let i = 0; i < data.length; i++) {
            const item = data[i];

            if (item.G !== 0 && item.G !== 1) {
                continue;
            }

            const newState = { ...state };
            item.G !== undefined && (newState.G = item.G);
            item.X !== undefined && (newState.X = item.X);
            item.Y !== undefined && (newState.Y = item.Y);
            item.Z !== undefined && (newState.Z = item.Z);
            item.B !== undefined && (newState.B = item.B);

            if (state.G !== newState.G
                || state.X !== newState.X
                || state.Y !== newState.Y
                || state.Z !== newState.Z
                || state.B !== newState.B) {
                const segCount = Math.max(Math.ceil(Math.abs(state.B - newState.B) / 5), 1);

                for (let j = 1; j <= segCount; j++) {
                    const res = this.calculateXYZ({
                        X: state.X + (newState.X - state.X) / segCount * j,
                        Y: state.Y + (newState.Y - state.Y) / segCount * j,
                        Z: state.Z + (newState.Z - state.Z) / segCount * j,
                        B: state.B + (newState.B - state.B) / segCount * j
                    });
                    positions.push(res.X);
                    positions.push(res.Y);
                    positions.push(res.Z);

                    if (state.G === 0 && newState.G === 1) {
                        gCodes.push(0);
                    } else {
                        gCodes.push(newState.G);
                    }
                }
                state = newState;
            }
        }
        const bufferGeometry = new THREE.BufferGeometry();
        const positionAttribute = new THREE.Float32BufferAttribute(positions, 3);
        const gCodeAttribute = new THREE.Float32BufferAttribute(gCodes, 1);
        bufferGeometry.addAttribute('position', positionAttribute);
        bufferGeometry.addAttribute('a_g_code', gCodeAttribute);
        const material = new THREE.ShaderMaterial({
            uniforms: UNIFORMS,
            vertexShader: CNC_LASER_VERT_SHADER,
            fragmentShader: CNC_LASER_FRAG_SHADER,
            side: THREE.DoubleSide,
            transparent: true,
            linewidth: 1
        });
        return new THREE.Line(bufferGeometry, material);
    }

    parseToPoints(data) {
        const geometry = new THREE.Geometry();
        const material = new THREE.PointsMaterial({
            size: 0.1,
            vertexColors: THREE.VertexColors,
            opacity: 0.9,
            transparent: true
        });
        let state = {
            G: 0,
            X: 0,
            Y: 0,
            Z: 0
        };
        for (let i = 0; i < data.length; i++) {
            const item = data[i];
            const newState = { ...state };
            item.G !== undefined && (newState.G = item.G);
            item.X !== undefined && (newState.X = item.X);
            item.Y !== undefined && (newState.Y = item.Y);
            item.Z !== undefined && (newState.Z = item.Z);

            if (state.G !== newState.G
                || state.X !== newState.X
                || state.Y !== newState.Y
                || state.Z !== newState.Z) {
                state = newState;
                const res = this.calculateXYZ(state);
                geometry.vertices.push(new THREE.Vector3(res.X, res.Y, res.Z));
                if (state.G === 0) {
                    geometry.colors.push(motionColor.G0);
                } else if (state.G === 1) {
                    geometry.colors.push(motionColor.G1);
                } else {
                    geometry.colors.push(motionColor.unknown);
                }
            }
        }
        return new THREE.Points(geometry, material);
    }

    calculateXYZ(state) {
        if (this.isRotate) {
            return {
                X: state.Z * Math.sin(state.B / 180 * Math.PI) + state.X * Math.cos(state.B / 180 * Math.PI),
                Y: state.Y,
                Z: state.Z * Math.cos(state.B / 180 * Math.PI) - state.X * Math.sin(state.B / 180 * Math.PI)
            };
        } else {
            return state;
        }
    }
}

export default ToolPathRenderer;
