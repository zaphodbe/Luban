import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import i18n from '../../lib/i18n';
import Anchor from '../../components/Anchor';

class JobType extends PureComponent {
    static propTypes = {
        setTitle: PropTypes.func.isRequired
    };

    state = {
    };

    actions = {

    };

    constructor(props) {
        super(props);
        this.props.setTitle(i18n._('Job Type'));
    }

    render() {
        return (
            <React.Fragment>
                <div className="container-fluid">
                    <div className="row">
                        <Anchor className="col-6">
                            <div style={{ margin: '0px -15px' }}>
                                <i className="fa fa-circle-o" aria-hidden="true" />
                                <span>3 Axis CNC</span>
                            </div>
                            <img
                                width="130px"
                                src="images/cnc/cnc-3th-2x.png"
                                role="presentation"
                                alt="3 Axis CNC"
                            />
                        </Anchor>
                        <Anchor className="col-6">
                            <div>4 Axis CNC</div>
                            <img
                                width="130px"
                                src="images/cnc/cnc-4th-2x.png"
                                role="presentation"
                                alt="4 Axis CNC"
                            />
                        </Anchor>
                    </div>
                </div>
                <div className="sm-parameter-row">
                    <span className="sm-parameter-row__label">{i18n._('Size (mm)')}</span>
                </div>
            </React.Fragment>
        );
    }
}

// eslint-disable-next-line no-unused-vars
const mapStateToProps = (state) => {
    return {
    };
};

// eslint-disable-next-line no-unused-vars
const mapDispatchToProps = (dispatch) => {
    return {
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(JobType);
