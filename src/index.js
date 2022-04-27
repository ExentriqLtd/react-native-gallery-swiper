import React, { PureComponent } from "react";
import { View, ViewPropTypes } from "react-native";
import PropTypes from "prop-types";
import { createResponder } from "react-native-easy-guesture-responder";
import ImageTransformer from "react-native-image-transformer";
import PageList from "react-native-page-list";

const DEFAULT_FLAT_LIST_PROPS = {
    windowSize: 3
};

export default class GallerySwiper extends PureComponent {
    static propTypes = {
        ...View.propTypes,
        images: PropTypes.arrayOf(PropTypes.object).isRequired,
        initialPage: PropTypes.number,
        resizeMode: PropTypes.string,
        initialNumToRender: PropTypes.number,
        scrollViewStyle: ViewPropTypes
            ? ViewPropTypes.style
            : View.propTypes.style,
        pageMargin: PropTypes.number,
        sensitiveScroll: PropTypes.bool,
        onPageSelected: PropTypes.func,
        onPageScrollStateChanged: PropTypes.func,
        onPageScroll: PropTypes.func,
        onPinchTransforming: PropTypes.func,
        onPinchStartReached: PropTypes.func,
        onPinchEndReached: PropTypes.func,
        onDoubleTapStartReached: PropTypes.func,
        onDoubleTapEndReached: PropTypes.func,
        onDoubleTapConfirmed: PropTypes.func,
        onSingleTapConfirmed: PropTypes.func,
        onGalleryStateChanged: PropTypes.func,
        onLongPress: PropTypes.func,
        onViewTransformed: PropTypes.func,
        onTransformGestureReleased: PropTypes.func,
        onSwipeUpReleased: PropTypes.func,
        onSwipeDownReleased: PropTypes.func,
        onEndReached: PropTypes.func,
        onEndReachedThreshold: PropTypes.number,
        enableScale: PropTypes.bool,
        maxScale: PropTypes.number,
        enableTranslate: PropTypes.bool,
        enableResistance: PropTypes.bool,
        resistantStrHorizontal: PropTypes.oneOfType([
            PropTypes.func,
            PropTypes.number,
            PropTypes.string
        ]),
        resistantStrVertical: PropTypes.oneOfType([
            PropTypes.func,
            PropTypes.number,
            PropTypes.string
        ]),
        maxOverScrollDistance: PropTypes.number,
        removeClippedSubviews: PropTypes.bool,
        imageComponent: PropTypes.func,
        injectComponent: PropTypes.func,
        errorComponent: PropTypes.func,
        flatListProps: PropTypes.object,
        refPage: PropTypes.func
    };

    static defaultProps = {
        style: {
            flex: 1,
            backgroundColor: "#000"
        },
        initialNumToRender: 7,
        imageComponent: undefined,
        injectComponent: undefined,
        scrollViewStyle: {},
        flatListProps: DEFAULT_FLAT_LIST_PROPS,
        onEndReachedThreshold: 0.5
    };

    imageRefs = new Map();
    activeResponder = undefined;
    firstMove = true;
    currentPage = 0;
    pageCount = 0;
    gestureResponder = undefined;

    constructor (props) {
        super(props);

        this.renderPage = this.renderPage.bind(this);
        this.onPageSelected = this.onPageSelected.bind(this);
        this.onPageScrollStateChanged = this.onPageScrollStateChanged.bind(this);
        this.getViewPagerInstance = this.getViewPagerInstance.bind(this);
        this.getCurrentImageTransformer = this.getCurrentImageTransformer.bind(this);
        this.getImageTransformer = this.getImageTransformer.bind(this);
        this.getViewPagerInstance = this.getViewPagerInstance.bind(this);
        this.activeImageResponder = this.activeImageResponder.bind(this);
        this.activeZoom = false;

        let onResponderReleaseOrTerminate = (evt, gestureState) => {
            if (this.activeResponder) {
                if (this.activeResponder === this.viewPagerResponder &&
                    !this.shouldScrollViewPager(evt, gestureState) &&
                    Math.abs(gestureState.vx) > 0.5) {
                    this.activeResponder.onEnd(evt, gestureState, true);
                    this.getViewPagerInstance().flingToPage(
                        this.currentPage,
                        gestureState.vx
                    );
                } else {
                    this.activeResponder.onEnd(evt, gestureState);
                }
                this.activeResponder = null;
            }
            this.firstMove = true;
            this.props.onGalleryStateChanged &&
                this.props.onGalleryStateChanged(true);
        };

        this.gestureResponder = createResponder({
            onStartShouldSetResponderCapture: (evt, gestureState) => true,
            onStartShouldSetResponder: (evt, gestureState) => true,
            onResponderGrant: this.activeImageResponder,
            onResponderMove: (evt, gestureState) => {
                if (this.firstMove) {
                    this.firstMove = false;
                     if (this.shouldScrollViewPager(evt, gestureState))  {    
                         this.activeViewPagerResponder(evt, gestureState);
                     }
                    this.props.onGalleryStateChanged &&
                        this.props.onGalleryStateChanged(false);
                }
                    if (this.activeResponder === this.viewPagerResponder) {
                    const dx = gestureState.moveX - gestureState.previousMoveX;
                    const offset = this.getViewPagerInstance()
                        .getScrollOffsetFromCurrentPage();
                    if (
                        dx > 0 && offset > 0 &&
                        !this.shouldScrollViewPager(evt, gestureState)
                    ) {
                        if (dx > offset) { // active image responder
                            this.getViewPagerInstance().scrollByOffset(offset);
                            gestureState.moveX -= offset;
                            this.activeImageResponder(evt, gestureState);
                        }
                    } else if (
                        dx < 0 && offset < 0 &&
                        !this.shouldScrollViewPager(evt, gestureState)
                    ) {
                        if (dx < offset) { // active image responder
                            this.getViewPagerInstance().scrollByOffset(offset);
                            gestureState.moveX -= offset;
                            this.activeImageResponder(evt, gestureState);
                        }
                    }
                }
                this.shouldScrollViewPager(evt, gestureState);
                this.activeResponder.onMove(evt, gestureState);
            },
            onResponderRelease: onResponderReleaseOrTerminate,
            onResponderTerminate: onResponderReleaseOrTerminate,
            // Do not allow parent view to intercept gesture
            onResponderTerminationRequest: (evt, gestureState) => false,
            onResponderDoubleTapConfirmed: (evt, gestureState) => {
                this.activeZoom = false;
                this.props.onDoubleTapConfirmed &&
                    this.props.onDoubleTapConfirmed(this.currentPage);
            },
            onResponderSingleTapConfirmed: (evt, gestureState) => {
                this.props.onSingleTapConfirmed &&
                    this.props.onSingleTapConfirmed(this.currentPage);
            }
        });

        this.viewPagerResponder = {
            onStart: (evt, gestureState) => {
                this.getViewPagerInstance()
                    .onResponderGrant(evt, gestureState);
            },
            onMove: (evt, gestureState) => {
                this.getViewPagerInstance()
                    .onResponderMove(evt, gestureState);
            },
            onEnd: (evt, gestureState, disableSettle) => {
                this.getViewPagerInstance()
                    .onResponderRelease(evt, gestureState, disableSettle);
            }
        };

        this.imageResponder = {
            onStart: (evt, gestureState) => {
                const currentImageTransformer = this.getCurrentImageTransformer();
                currentImageTransformer &&
                    currentImageTransformer.onResponderGrant(evt, gestureState);
                if (this.props.onLongPress) {
                    this._longPressTimeout = setTimeout(() => {
                        this.props.onLongPress(gestureState, this.currentPage);
                    }, 600);
                }
            },
            onMove: (evt, gestureState) => {
                const currentImageTransformer = this.getCurrentImageTransformer();
                currentImageTransformer &&
                    currentImageTransformer.onResponderMove(evt, gestureState);
                clearTimeout(this._longPressTimeout);
            },
            onEnd: (evt, gestureState) => {
                if (!this.activeZoom) {
                    const currentImageTransformer = this.getCurrentImageTransformer();
                    currentImageTransformer &&
                        currentImageTransformer.onResponderRelease(evt, gestureState);
                  clearTimeout(this._longPressTimeout);    
                }
            }
        };
    }

    componentDidMount () {
        this._isMounted = true;
    }

    componentWillUnmount () {
        this._isMounted = false;
    }

    shouldScrollViewPager (evt, gestureState) {
        if (gestureState.numberActiveTouches > 1) {
            return false;
        }
        const viewTransformer = this.getCurrentImageTransformer();
        if (!viewTransformer) {
            return false;
        }
        
        const space = viewTransformer.getAvailableTranslateSpace();
        const dx = gestureState.moveX - gestureState.previousMoveX;
    
        if(dx > 0 && space.right < 0.5 && this.currentPage == 0){
            this.activeViewPagerResponder(evt, gestureState);
        }
        if(dx < 0 && space.left <= 0.5 && this.currentPage == this.pageCount - 1){
           
            this.activeViewPagerResponder(evt, gestureState);
        }
        if (dx < 0 && space.left <= 0 && (space.bottom == 0 && space.top == 0 || this.activeZoom)  && this.currentPage < this.pageCount - 1) {
            this.activeViewPagerResponder(evt, gestureState);
            return true;
        }
        if (dx > 0 && space.right <= 0 && (space.bottom == 0 && space.top == 0 || this.activeZoom)  && this.currentPage > 0) {
            this.activeViewPagerResponder(evt, gestureState);
            return true;
        }
        return false;
    }

    activeImageResponder (evt, gestureState) {
        if (this.activeResponder !== this.imageResponder) {
            if (this.activeResponder === this.viewPagerResponder) {
                // pass true to disable ViewPager settle
                this.viewPagerResponder.onEnd(evt, gestureState, true);
            }
            this.activeResponder = this.imageResponder;
            this.imageResponder.onStart(evt, gestureState);
        }
    }

    activeViewPagerResponder (evt, gestureState) {
        if (this.activeResponder !== this.viewPagerResponder) {
            if (this.activeResponder === this.imageResponder) {
                this.imageResponder.onEnd(evt, gestureState); 
            }
            this.activeResponder = this.viewPagerResponder;
            this.viewPagerResponder.onStart(evt, gestureState);
        }
    }

    getImageTransformer (page) {
        if (page >= 0 && page < this.pageCount) {
            let ref = this.imageRefs.get(page);
            if (ref) {
                return ref.getViewTransformerInstance();
            }
        }
    }

    getCurrentImageTransformer () {
        return this.getImageTransformer(this.currentPage);
    }

    getViewPagerInstance () {
        return this._galleryViewPager;
    }

    onPageSelected (page) {
        this.currentPage = page;
        this.props.onPageSelected && this.props.onPageSelected(page);

        if (
            this.props.onEndReached &&
            page + 1 > this.props.onEndReachedThreshold * this.props.images.length
        ) {
            this.props.onEndReached && this.props.onEndReached();
        }
    }

    onPageScrollStateChanged (state) {
        if (state === "idle") {
            this.resetHistoryImageTransform();
        }
        this.props.onPageScrollStateChanged &&
            this.props.onPageScrollStateChanged(state);
    }

    renderPage (pageData, pageId) {
        const {
            onViewTransformed, onPinchTransforming, onPinchStartReached, onPinchEndReached,
            onTransformGestureReleased, onSwipeUpReleased, onSwipeDownReleased, onDoubleTapStartReached,
            onDoubleTapEndReached, resizeMode, enableResistance, enableScale, maxScale, enableTranslate,
            resistantStrHorizontal, resistantStrVertical, maxOverScrollDistance, errorComponent,
            imageComponent, injectComponent
        } = this.props;
        
        return (
            <ImageTransformer
                injectComponent={injectComponent}
                onViewTransformed={(transform) => {
                    onViewTransformed &&
                        onViewTransformed(transform, pageId);
                }}
                onPinchTransforming={(transform) => {
                    onPinchTransforming &&
                        onPinchTransforming(transform, pageId);
                }}
                onPinchStartReached={(transform) => {
                    onPinchStartReached &&
                        onPinchStartReached(transform, pageId);
                }}
                onPinchEndReached={(transform) => {
                    const { scale } = transform
                    if (scale && scale <= 1) {
                        this.activeZoom = false;
                    }
                    else if (scale && scale > 1) {
                        this.activeZoom = true;
                    }
                    onPinchEndReached &&
                        onPinchEndReached(transform, pageId);
                }}
                onTransformGestureReleased={(transform) => {
                    return onTransformGestureReleased &&
                        onTransformGestureReleased(transform, pageId);
                }}
                onSwipeUpReleased={(transform) => {
                    onSwipeUpReleased &&
                        onSwipeUpReleased(transform, pageId);
                }}
                onSwipeDownReleased={(transform) => {
                    onSwipeDownReleased &&
                        onSwipeDownReleased(transform, pageId);
                }}
                onDoubleTapStartReached={(transform) => {
                    onDoubleTapStartReached &&
                        onDoubleTapStartReached(transform, pageId);
                }} 
                onDoubleTapEndReached={(transform) => {
                    onDoubleTapEndReached &&
                        onDoubleTapEndReached(transform, pageId);
                }}
                ref={(ref) => { this.imageRefs.set(pageId, ref); }}
                key={"innerImage#" + pageId}
                errorComponent={errorComponent}
                imageComponent={imageComponent}
                image={pageData}
                index={pageId}
                enableScale={enableScale}
                maxScale={maxScale}
                enableTranslate={enableTranslate}
                enableResistance={enableResistance}
                resistantStrHorizontal={resistantStrHorizontal}
                resistantStrVertical={resistantStrVertical}
                maxOverScrollDistance={maxOverScrollDistance}
                resizeMode={resizeMode}
            />
        );
    }

    resetHistoryImageTransform () {
        let transformer = this.getImageTransformer(
            this.currentPage + 1
        );
        if (transformer) {
            transformer.forceUpdateTransform({
                scale: 1,
                translateX: 0,
                translateY: 0
            });
        }

        transformer = this.getImageTransformer(
            this.currentPage - 1
        );
        if (transformer) {
            transformer.forceUpdateTransform({
                scale: 1,
                translateX: 0,
                translateY: 0
            });
        }
    }

    flingToPage ({ index, velocityX }) {
        this._galleryViewPager &&
            this._galleryViewPager.flingToPage(index, velocityX);
    }

    scrollToPage ({ index, immediate }) {
        this._galleryViewPager &&
            this._galleryViewPager.scrollToPage(index, immediate);
    }

    render () {
        let gestureResponder = this.gestureResponder;

        let images = this.props.images;
        if (!images) {
            images = [];
        }
        this.pageCount = images.length;

        if (this.pageCount <= 0) {
            gestureResponder = {};
        }

        const flatListProps = {
            ...DEFAULT_FLAT_LIST_PROPS,
            ...this.props.flatListProps
        };

        return (
            <PageList
                {...this.props}
                flatListProps={flatListProps}
                ref={(component) => {
                    this._galleryViewPager = component;
                    this.props.refPage &&
                        this.props.refPage(component);
                }}
                scrollViewStyle={this.props.scrollViewStyle}
                scrollEnabled={false}
                renderPage={this.renderPage}
                pageDataArray={images}
                {...gestureResponder}
                sensitiveScroll={this.props.sensitiveScroll}
                onPageSelected={this.onPageSelected}
                onPageScrollStateChanged={this.onPageScrollStateChanged}
                onPageScroll={this.props.onPageScroll}
                removeClippedSubviews={this.props.removeClippedSubviews}
                initialNumToRender={this.props.initialNumToRender}
            />
        );
    }
}
