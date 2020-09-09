import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';

import { PAGE_EDITOR, PAGE_PROCESS, SOURCE_TYPE_IMAGE3D } from '../../constants';
import i18n from '../../lib/i18n';
import Transformation from '../CncLaserShared/Transformation';
import GcodeParameters from '../CncLaserShared/GcodeParameters';
import TextParameters from '../CncLaserShared/TextParameters';
import VectorParameters from './VectorParameters';
import Image3dParameters from './Image3dParameters';
import ImageProcessMode from './ImageProcessMode';
import ReliefGcodeParameters from './gcodeconfig/ReliefGcodeParameters';
import Image3DGcodeParameters from './gcodeconfig/Image3DGcodeParameters';
import { actions as editorActions } from '../../flux/editor';

class CNCPath extends PureComponent {
    static propTypes = {
        setTitle: PropTypes.func.isRequired,

        page: PropTypes.string.isRequired,

        // model: PropTypes.object,
        selectedModelID: PropTypes.string,
        selectedModelHideFlag: PropTypes.bool,
        sourceType: PropTypes.string,
        mode: PropTypes.string.isRequired,
        showOrigin: PropTypes.bool,
        config: PropTypes.object.isRequired,
        transformation: PropTypes.object.isRequired,
        gcodeConfig: PropTypes.object.isRequired,
        printOrder: PropTypes.number.isRequired,
        updateSelectedModelTransformation: PropTypes.func.isRequired,
        updateSelectedModelFlip: PropTypes.func.isRequired,
        updateSelectedModelConfig: PropTypes.func.isRequired,
        updateSelectedModelGcodeConfig: PropTypes.func.isRequired,
        updateSelectedModelPrintOrder: PropTypes.func.isRequired,
        updateSelectedModelTextConfig: PropTypes.func.isRequired,
        onModelAfterTransform: PropTypes.func.isRequired,
        changeSelectedModelShowOrigin: PropTypes.func.isRequired,
        changeSelectedModelMode: PropTypes.func.isRequired
    };

    state = {
    };

    actions = {
    };

    constructor(props) {
        super(props);
        this.props.setTitle(i18n._('Configurations'));
    }

    render() {
        const {
            page,
            selectedModelID, selectedModelHideFlag, sourceType, mode,
            showOrigin,
            transformation, updateSelectedModelTransformation,
            gcodeConfig, updateSelectedModelGcodeConfig, updateSelectedModelConfig,
            printOrder, updateSelectedModelPrintOrder, config, updateSelectedModelTextConfig,
            onModelAfterTransform, changeSelectedModelShowOrigin, changeSelectedModelMode, updateSelectedModelFlip
        } = this.props;
        const selectedNotHide = selectedModelID && !selectedModelHideFlag;

        const isRasterGreyscale = (sourceType === 'raster' && mode === 'greyscale');
        const isSvgVector = ((sourceType === 'svg' || sourceType === 'dxf') && mode === 'vector');
        const isTextVector = (sourceType === 'text' && mode === 'vector');
        const isImage3d = (sourceType === SOURCE_TYPE_IMAGE3D);
        const isEditor = page === PAGE_EDITOR;
        const isProcess = page === PAGE_PROCESS;
        const isProcessMode = isEditor && sourceType === 'raster';

        return (
            <React.Fragment>
                {isEditor && (
                    <Transformation
                        selectedModelID={selectedModelID}
                        selectedModelHideFlag={selectedModelHideFlag}
                        headType="cnc"
                        transformation={transformation}
                        sourceType={sourceType}
                        updateSelectedModelTransformation={updateSelectedModelTransformation}
                        updateSelectedModelFlip={updateSelectedModelFlip}
                        onModelAfterTransform={onModelAfterTransform}
                    />
                )}
                {selectedModelID && (
                    <div className="sm-parameter-container">
                        {isProcessMode && (
                            <ImageProcessMode
                                sourceType={sourceType}
                                mode={mode}
                                disabled={!selectedNotHide}
                                showOrigin={showOrigin}
                                changeSelectedModelShowOrigin={changeSelectedModelShowOrigin}
                                changeSelectedModelMode={changeSelectedModelMode}
                            />
                        )}
                        {isEditor && isTextVector && (
                            <TextParameters
                                disabled={selectedModelHideFlag}
                                config={config}
                                updateSelectedModelTextConfig={updateSelectedModelTextConfig}
                            />
                        )}
                        {isEditor && isImage3d && (
                            <Image3dParameters
                                disabled={selectedModelHideFlag}
                                config={config}
                                updateSelectedModelConfig={updateSelectedModelConfig}
                            />
                        )}
                        {isProcess && (isSvgVector || isTextVector) && (
                            <VectorParameters
                                disabled={selectedModelHideFlag}
                            />
                        )}
                        {isProcess && isRasterGreyscale && (
                            <ReliefGcodeParameters
                                disabled={selectedModelHideFlag}
                            />
                        )}
                        {isProcess && isImage3d && (
                            <Image3DGcodeParameters
                                disabled={selectedModelHideFlag}
                            />
                        )}
                    </div>
                )}
                {isProcess && (
                    <GcodeParameters
                        selectedModelID={selectedModelID}
                        selectedModelHideFlag={selectedModelHideFlag}
                        printOrder={printOrder}
                        gcodeConfig={gcodeConfig}
                        updateSelectedModelGcodeConfig={updateSelectedModelGcodeConfig}
                        updateSelectedModelPrintOrder={updateSelectedModelPrintOrder}
                        paramsDescs={
                            {
                                jogSpeed: i18n._('Determines how fast the tool moves when it’s not carving.'),
                                workSpeed: i18n._('Determines how fast the tool feeds into the material.'),
                                plungeSpeed: i18n._('Determines how fast the tool moves on the material.')
                            }
                        }
                    />
                )}
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    const { page, selectedModelID, modelGroup, sourceType, mode, showOrigin, transformation, gcodeConfig, printOrder, config } = state.cnc;

    return {
        page,
        printOrder,
        transformation,
        gcodeConfig,
        // model,
        selectedModelID,
        // todo, next version fix like selectedModelID
        selectedModelHideFlag: modelGroup.getSelectedModel() && modelGroup.getSelectedModel().hideFlag,
        modelGroup,
        sourceType,
        mode,
        showOrigin,
        config
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateSelectedModelTransformation: (params) => dispatch(editorActions.updateSelectedModelTransformation('cnc', params)),
        updateSelectedModelFlip: (params) => dispatch(editorActions.updateSelectedModelFlip('cnc', params)),
        updateSelectedModelConfig: (params) => dispatch(editorActions.updateSelectedModelConfig('cnc', params)),
        updateSelectedModelGcodeConfig: (params) => dispatch(editorActions.updateSelectedModelGcodeConfig('cnc', params)),
        updateSelectedModelPrintOrder: (printOrder) => dispatch(editorActions.updateSelectedModelPrintOrder('cnc', printOrder)),
        updateSelectedModelTextConfig: (config) => dispatch(editorActions.updateSelectedModelTextConfig('cnc', config)),
        onModelAfterTransform: () => dispatch(editorActions.onModelAfterTransform('cnc')),
        changeSelectedModelShowOrigin: () => dispatch(editorActions.changeSelectedModelShowOrigin('cnc')),
        changeSelectedModelMode: (sourceType, mode) => dispatch(editorActions.changeSelectedModelMode('cnc', sourceType, mode))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(CNCPath);
