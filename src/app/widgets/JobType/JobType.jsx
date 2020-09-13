import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import i18n from '../../lib/i18n';
import Anchor from '../../components/Anchor';
import { actions as editorActions } from '../../flux/editor';
import { JOB_TYPE_3AXIS, JOB_TYPE_4AXIS, PAGE_EDITOR } from '../../constants';
import { NumberInput as Input } from '../../components/Input';

class JobType extends PureComponent {
    static propTypes = {
        setTitle: PropTypes.func.isRequired,
        setDisplay: PropTypes.func.isRequired,

        page: PropTypes.string.isRequired,

        size: PropTypes.object.isRequired,

        jobType: PropTypes.string.isRequired,
        jobSize: PropTypes.object.isRequired,

        changeJobType: PropTypes.func.isRequired,
        updateJobSize: PropTypes.func.isRequired
    };

    state = {
    };

    actions = {
    };

    constructor(props) {
        super(props);
        this.props.setTitle(i18n._('Job Type'));
    }

    componentWillReceiveProps(nextProps) {
        this.props.setDisplay(nextProps.page === PAGE_EDITOR);
    }

    render() {
        const { size, jobType, jobSize } = this.props;
        const { diameter, length } = jobSize;

        const isRotate = jobType === JOB_TYPE_4AXIS;

        return (
            <React.Fragment>
                <div className="container-fluid">
                    <div className="row">
                        <Anchor className="col-6" onClick={() => { this.props.changeJobType(JOB_TYPE_3AXIS); }}>
                            <div>
                                <i
                                    style={{
                                        marginRight: '8px'
                                    }}
                                    className={isRotate ? 'fa fa-circle-o' : 'fa fa-dot-circle-o'}
                                    aria-hidden="true"
                                />
                                <span>3 Axis CNC</span>
                            </div>
                            <img
                                style={{
                                    margin: '8px 0px 0px 0px'
                                }}
                                width="130px"
                                src="images/cnc/cnc-3th-2x.png"
                                role="presentation"
                                alt="3 Axis CNC"
                            />
                        </Anchor>
                        <Anchor className="col-6" onClick={() => { this.props.changeJobType(JOB_TYPE_4AXIS); }}>
                            <div>
                                <i
                                    style={{
                                        marginRight: '8px'
                                    }}
                                    className={isRotate ? 'fa fa-dot-circle-o' : 'fa fa-circle-o'}
                                    aria-hidden="true"
                                />
                                <span>4 Axis CNC</span>
                            </div>
                            <img
                                style={{
                                    margin: '8px 0px 0px 0px'
                                }}
                                width="130px"
                                src="images/cnc/cnc-4th-2x.png"
                                role="presentation"
                                alt="4 Axis CNC"
                            />
                        </Anchor>
                    </div>
                </div>
                {isRotate && (
                    <div style={{
                        marginTop: '16px',
                        padding: '0px 15px 0px 15px'
                    }}
                    >
                        <div className="sm-parameter-row">
                            <span className="sm-parameter-row__label">{i18n._('Diameter')}</span>
                            <Input
                                disabled={false}
                                className="sm-parameter-row__input"
                                value={diameter}
                                max={size.x / Math.PI}
                                min={0.1}
                                onChange={(value) => { this.props.updateJobSize({ diameter: value }); }}
                            />
                            <span className="sm-parameter-row__input-unit">mm</span>
                        </div>
                        <div className="sm-parameter-row">
                            <span className="sm-parameter-row__label">{i18n._('Length')}</span>
                            <Input
                                disabled={false}
                                className="sm-parameter-row__input"
                                value={length}
                                max={size.y}
                                min={0.1}
                                onChange={(value) => { this.props.updateJobSize({ length: value }); }}
                            />
                            <span className="sm-parameter-row__input-unit">mm</span>
                        </div>
                    </div>

                )}
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state, ownProps) => {
    const { headType } = ownProps;
    const { size } = state.machine;
    console.log('headType', headType);
    const { page, jobType, jobSize } = state[headType];

    return {
        size,
        page,
        jobType,
        jobSize
    };
};

const mapDispatchToProps = (dispatch, ownProps) => {
    const { headType } = ownProps;

    return {
        changeJobType: (jobType) => dispatch(editorActions.changeJobType(headType, jobType)),
        updateJobSize: (jobSize) => dispatch(editorActions.updateJobSize(headType, jobSize))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(JobType);
