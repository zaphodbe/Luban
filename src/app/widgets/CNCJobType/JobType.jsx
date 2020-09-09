import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import i18n from '../../lib/i18n';
import Anchor from '../../components/Anchor';
import { actions as cncActions } from '../../flux/cnc';
import { JOB_TYPE_3AXIS, JOB_TYPE_4AXIS, PAGE_EDITOR } from '../../constants';
import { NumberInput as Input } from '../../components/Input';

class JobType extends PureComponent {
    static propTypes = {
        setTitle: PropTypes.func.isRequired,
        setDisplay: PropTypes.func.isRequired,

        page: PropTypes.string.isRequired,

        jobType: PropTypes.string.isRequired,
        jobSize: PropTypes.object.isRequired,

        changeJobType: PropTypes.func.isRequired,
        changeJobSize: PropTypes.func.isRequired
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
        const { jobType, jobSize } = this.props;
        const { diameter } = jobSize;
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
                                onChange={(value) => { this.props.changeJobSize({ diameter: value }); }}
                            />
                            <span className="sm-parameter-row__input-unit">mm</span>
                        </div>
                    </div>
                )}
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state) => {
    const { page, jobType, jobSize } = state.cnc;

    return {
        page,
        jobType,
        jobSize
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        changeJobType: (jobType) => dispatch(cncActions.changeJobType(jobType)),
        changeJobSize: (jobSize) => dispatch(cncActions.changeJobSize(jobSize))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(JobType);
