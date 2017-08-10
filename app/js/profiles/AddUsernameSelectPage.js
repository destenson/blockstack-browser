import React, { Component, PropTypes } from 'react'
import { Link } from 'react-router'
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import { AccountActions } from '../account/store/account'
import { AvailabilityActions } from './store/availability'
import { IdentityActions } from './store/identity'
import { RegistrationActions } from './store/registration'
import { hasNameBeenPreordered } from '../utils/name-utils'
import roundTo from 'round-to'
import { QRCode } from 'react-qr-svg'


import log4js from 'log4js'

const logger = log4js.getLogger('profiles/AddUsernameSelectPage.js')

function mapStateToProps(state) {
  return {
    api: state.settings.api,
    availability: state.profiles.availability,
    walletBalance: state.account.coreWallet.balance,
    walletAddress: state.account.coreWallet.address,
    identityKeypairs: state.account.identityAccount.keypairs,
    identityAddresses: state.account.identityAccount.addresses,
    registration: state.profiles.registration,
    localIdentities: state.profiles.identity.localIdentities,
    balanceUrl: state.settings.api.zeroConfBalanceUrl
  }
}

function mapDispatchToProps(dispatch) {
  return bindActionCreators(Object.assign({},
    IdentityActions, AccountActions, RegistrationActions, AvailabilityActions), dispatch)
}

class AddUsernameSelectPage extends Component {
  static propTypes = {
    routeParams: PropTypes.object.isRequired,
    router: PropTypes.object.isRequired,
    api: PropTypes.object.isRequired,
    availability: PropTypes.object.isRequired,
    refreshCoreWalletBalance: PropTypes.func.isRequired,
    walletBalance: PropTypes.number.isRequired,
    walletAddress: PropTypes.string.isRequired,
    registerName: PropTypes.func.isRequired,
    identityKeypairs: PropTypes.array.isRequired,
    identityAddresses: PropTypes.array.isRequired,
    registration: PropTypes.object.isRequired,
    localIdentities: PropTypes.object.isRequired,
    balanceUrl: PropTypes.string.isRequired
  }

  constructor(props) {
    super(props)
    const ownerAddress = this.props.routeParams.index
    const name = this.props.routeParams.name
    const availableNames = this.props.availability.names
    const nameAvailabilityObject = availableNames[name]
    if (!nameAvailabilityObject) {
      logger.error(`componentDidMount: not sure if ${name} is available.`)
      props.router.push(`/profiles/i/add-username/${ownerAddress}/search`)
    }

    const nameHasBeenPreordered = hasNameBeenPreordered(name, props.localIdentities)
    if (nameHasBeenPreordered) {
      logger.error(`constructor: Name ${name} has already been preordered.`)
      props.router.push('/profiles')
    }

    this.state = {
      ownerAddress,
      name,
      registrationInProgress: false
    }
    this.findAddressIndex = this.findAddressIndex.bind(this)
    this.register = this.register.bind(this)
  }

  componentDidMount() {
    logger.trace('componentDidMount')
    console.log(this.props.balanceUrl)
    this.props.refreshCoreWalletBalance(this.props.balanceUrl,
      this.props.api.coreAPIPassword)

  }

  componentWillReceiveProps(nextProps) {
    const registration = nextProps.registration

    if (this.state.registrationInProgress && registration.registrationSubmitted) {
      logger.debug('componentWillReceiveProps: registration submitted! redirecting...')
      this.props.router.push('/profiles') // TODO this should go to the status page
    }
  }

  findAddressIndex(address) {
    const identityAddresses = this.props.identityAddresses
    for (let i = 0; i < identityAddresses.length; i++) {
      if (identityAddresses[i] === address) {
        return i
      }
    }
    return null
  }

  register(event) {
    logger.trace('register')
    event.preventDefault()
    this.setState({
      registrationInProgress: true
    })
    const ownerAddress = this.props.routeParams.index
    const name = this.props.routeParams.name
    const nameHasBeenPreordered = hasNameBeenPreordered(name, this.props.localIdentities)

    if (nameHasBeenPreordered) {
      logger.error(`register: Name ${name} has already been preordered`)
    } else {
      const addressIndex = this.findAddressIndex(ownerAddress)

      if (!addressIndex) {
        logger.error(`register: can't find address ${ownerAddress}`)
      }

      logger.debug(`register: ${ownerAddress} index is ${addressIndex}`)

      const address = this.props.identityAddresses[addressIndex]

      if (ownerAddress !== address) {
        logger.error(`register: Address ${address} at index ${addressIndex} doesn't match owner address ${ownerAddress}`)
      }

      const keypair = this.props.identityKeypairs[addressIndex]

      const nameTokens = name.split('.')
      const nameSuffix = name.split(nameTokens[0])
      const isSubdomain = nameTokens.length === 0

      logger.debug(`register: ${name} has name suffix ${nameSuffix}`)
      logger.debug(`register: is ${name} a subdomain? ${isSubdomain}`)

      if (isSubdomain) {
        // TODO implement subdomains
      } else {
        this.props.registerName(this.props.api, name, address, keypair)
      }
      //
      logger.debug(`register: ${name} preordered! Waiting for registration confirmation.`)
    }
  }

  render() {
    const name = this.props.routeParams.name
    const availableNames = this.props.availability.names
    const nameAvailabilityObject = availableNames[name]
    const isSubdomain = name.split('.').length === 3
    let enoughMoney = false
    let price = 0
    if (nameAvailabilityObject) {
      price = nameAvailabilityObject.price
    }
    price = roundTo(price, 3)
    const walletBalance = this.props.walletBalance

    if (isSubdomain || (walletBalance > price)) {
      enoughMoney = true
    }

    const registrationInProgress = this.state.registrationInProgress

    return (
      <div>
        <div className="container vertical-split-content">
          <div className="col-sm-2">
          </div>
          <div className="col-sm-8">
            {enoughMoney ?
              <div>
                <h3>Are you sure you want to buy <strong>{name}</strong>?</h3>
                <p>Purchasing <strong>{name}</strong> will spend {price} bitcoins
                from your wallet.</p>
                <div
                  style={{ textAlign: 'center' }}
                >
                  <button
                    onClick={this.register}
                    className="btn btn-primary"
                    disabled={registrationInProgress}
                  >
                    {registrationInProgress ?
                      <span>Buying...</span>
                      :
                      <span>Buy</span>
                    }
                  </button>
                  <br />
                  {registrationInProgress ?
                    null
                    :
                    <Link to="/profiles">
                      Cancel
                    </Link>
                  }
                </div>
              </div>
              :
              <div>
                <h3>Buy {name}</h3>
                <p>Send {price} bitcoins to your wallet:<br/>
                <strong>{this.props.walletAddress}</strong></p>
                <div style={{ textAlign: 'center' }}>
                  <QRCode
                    style={{ width: 256 }}
                    value={this.props.walletAddress}
                  />
                  <div>
                    <div className="progress">
                      <div
                        className="progress-bar progress-bar-striped progress-bar-animated"
                        role="progressbar"
                        aria-valuenow="100"
                        aria-valuemin="0"
                        aria-valuemax="100"
                        style={{ width: '100%' }}
                      >
                      Waiting for payment...
                      </div>
                    </div>
                    <Link
                      to="/profiles"
                      className="btn btn-secondary btn-sm"
                    >
                      Cancel
                    </Link>
                  </div>
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    )
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(AddUsernameSelectPage)